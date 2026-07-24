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

This tutorial builds a graph from the **same four _E. coli_ strains** as the
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

- `docker`, for the cactus image (which carries odgi, halSynteny, hal2maf,
  taffy, and `samtools`)
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
`halSynteny`, `hal2maf`, and
[taffy](https://github.com/ComparativeGenomicsToolkit/taffy), so no other tool
is needed for the projections.

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
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"],
  "adapter": {
    "type": "AllVsAllIndexedPAFAdapter",
    "pifGzLocation": { "uri": "ecoli_cactus_ava.pif.gz" },
    "index": { "location": { "uri": "ecoli_cactus_ava.pif.gz.tbi" } },
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"]
  }
}
```

Stack the four strains in a linear synteny view exactly as the
[all-vs-all tutorial](/docs/tutorials/allvsall_synteny#stacking-the-genomes)
describes.

<Figure caption="The Minigraph-Cactus graph's synteny projection: the four strains stacked K12 to NCTC86, a halSynteny ribbon between each adjacent pair drawn from the graph's HAL. The continuous diagonals are shared backbone; NCTC86 aligns to the others on the opposite strand (the crossed ribbons), the same orientation the pggb graph reports." src="/img/pangenome_cactus/synteny.png" />

## Pangenome variants projection

`--vcf` decomposes the graph against the K12 reference with
[`vg deconstruct`](https://github.com/vgteam/vg), genotyped across the other
three strains. Unlike `pggb -V`, its `CHROM` is already the reference contig
(`chr`) and its samples are the three non-reference strains, so it loads
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

<Figure caption="The Minigraph-Cactus graph's pangenome variants as a multi-sample matrix on K12, with the MAF alignment stacked below and the K12 gene lane above. Each matrix column is one variant vg deconstruct called against K12, each row one of the other three strains, each cell that strain's genotype (see the legend)." src="/img/pangenome_cactus/variant_matrix.png" />

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
in_cactus taffy view -i /data/ecoli_cactus.maf -o /data/ecoli_cactus.taf.gz -c   # -c bgzips
in_cactus taffy index -i /data/ecoli_cactus.taf.gz                               # -> .taf.gz.tai
```

Load the bgzipped-TAF with a
[`BgzipTaffyAdapter`](/docs/config/bgziptaffyadapter):

```json
{
  "type": "MafTrack",
  "trackId": "ecoli_cactus_maf",
  "name": "MC graph: whole-genome alignment (MAF, vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BgzipTaffyAdapter",
    "samples": ["K12", "Sakai", "CFT073", "NCTC86"],
    "tafGzLocation": { "uri": "ecoli_cactus.taf.gz" },
    "taiLocation": { "uri": "ecoli_cactus.taf.gz.tai" }
  }
}
```

<Figure caption="The Minigraph-Cactus HAL projected onto K12 as a MAF: the coverage band on top, then one row per strain (K12 first), colored where each differs from K12. On this shared-backbone window all four align continuously, so the mismatch columns read as SNP divergence from K12." src="/img/pangenome_cactus/maf.png" />

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
counts how many paths traverse the graph under each K12 base (near 4 where all
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
[`QuantitativeTrack`](/docs/config_guides/quantitative_track) on K12.

<Figure caption="odgi depth across all 4.64 Mb of K12 from the Minigraph-Cactus graph. The curve sits near 4 where all four strains traverse the graph (core sequence) and drops toward 1 over the accessory stretches private to fewer strains. At this zoom each pixel is a bigWig summary bin covering roughly 4 kb, so the shades of blue are one bin's range rather than separate signals: the palest reaches the bin's maximum depth, the mid tone its mean, the darkest its minimum. A pale column standing over a dark floor is an accessory stretch narrower than a bin." src="/img/pangenome_cactus/depth.png" />

[`odgi pav`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_pav.html)
splits that aggregate per strain. Slice each non-K12 strain's rows into its own
bigWig and load the set as one
[`MultiQuantitativeTrack`](/docs/user_guides/multiquantitative_track):

```bash
in_cactus odgi pav -i /data/mc/ecoli.full.og -b /data/depth_windows.bed > pav.tsv
for strain in Sakai CFT073 NCTC86; do
  group=$(awk -F'\t' -v s="$strain" 'NR>1 && $5 ~ "^"s"#" {print $5; exit}' pav.tsv)
  awk -F'\t' -v OFS='\t' -v g="$group" '$5==g && $6+0==$6 {print "chr",$2,$3,$6}' \
    pav.tsv | sort -k1,1 -k2,2n > "ecoli_cactus_pav_$strain.bedgraph"
  bedGraphToBigWig "ecoli_cactus_pav_$strain.bedgraph" chrom.sizes "ecoli_cactus_pav_$strain.bw"
done
```

<Figure caption="odgi pav over the same K12 windows, one row per non-K12 strain from the Minigraph-Cactus graph. Each row holds near 1 where that strain is present and drops to 0 over its own accessory stretches, so a single dip in the aggregate depth curve resolves here into which strain accounts for it." src="/img/pangenome_cactus/pav.png" />

## Compared to `odgi viz`

`--viz` already wrote `mc/ecoli.viz/chr.full.viz.png`, the same
[`odgi viz`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_viz.html)
graph raster the pggb tutorial contrasts against its projections: one row per
strain, but with the graph's node order on the horizontal axis instead of a
genome coordinate. The
[pggb tutorial's `odgi viz` section](/docs/tutorials/pangenome_ecoli#compared-to-odgi-viz)
explains that trade-off in full; it applies identically here, because both
builders produce the same kind of graph and the same odgi renders it.

<Figure caption="The four-strain Minigraph-Cactus graph drawn by odgi viz: one row per strain, colored where that strain traverses the graph and white where it does not. The horizontal axis is graph node order, not K12 position, so nothing lines up with a gene or coordinate. The three boxes mark loci carried over to the JBrowse figure below." src="/img/pangenome_cactus/graph.png" />

The two axes are easiest to tell apart by putting the same loci on both. The
three boxes above and the three bands below are the same three 100 kb stretches
of K12, in the same three colors:

<Figure caption="The same three loci on K12's coordinates, over the pangenome depth track. Each band is 100 kb (2.15% of the K12 axis) but the matching box above spans 4.4-6.2% of the graph axis, because the graph counts the other strains' accessory sequence through the same locus as well." src="/img/pangenome_cactus/graph_correspondence.png" />

Every box is wider than its band, by 2 to 3 times. That difference is the whole
distinction: the graph axis counts pangenome bases, so a locus where the other
strains carry sequence K12 lacks takes up more of it, while the JBrowse axis
counts K12 bases and holds every locus to its reference width. The boxed loci
are the three where that gap is largest, which is why each one also sits over a
dip in the depth track.

## Opening a boxed locus in a multi-way synteny view

The depth track says a locus is accessory and the graph raster says it is wide,
but neither says _what_ is there. The synteny projection does: stack the four
strains as above and zoom every row to that locus.

| Box    | K12 window                | What the graph is counting                                                           |
| ------ | ------------------------- | ------------------------------------------------------------------------------------ |
| blue   | `chr:1,000,000-1,100,000` | Sakai's 66 kb stx2 prophage, plus an 84 kb second Sakai-only stretch                 |
| orange | `chr:2,040,000-2,140,000` | a 33 kb K12 stretch none of the three carry, and a 171 kb CFT073-only insert         |
| green  | `chr:3,100,000-3,200,000` | one breakpoint, three different inserts: 128 kb in CFT073, 84 kb NCTC86, 23 kb Sakai |

Each row needs its own window, because the same locus is at a different
coordinate (and a different length) in each strain. Read them off the synteny
PAF rather than guessing: for the blue box the K12 window's end points fall in
halSynteny blocks that place it at Sakai `chr:1,129,000-1,462,000`, CFT073
`chr:1,044,000-1,243,500`, and NCTC86 `chr:2,972,000-3,062,000` (reverse
orientation, so that ribbon crosses). The interactive equivalent is to navigate
the K12 row, then right-click a ribbon and pick **Center on feature**, which
puts the row below on the matching alignment.

Do not square the rows to a common width here. The span each row needs _is_ the
result: 100 kb of K12 costs 333 kb in Sakai, 200 kb in CFT073, and 90 kb in
NCTC86, which is the same 2 to 3 times spread the graph axis showed.

<Figure caption="The blue box opened as a four-way synteny view, each row windowed to the sequence that aligns to K12 chr:1,000,000-1,100,000. The ribbons shear instead of running horizontal because each row spans a different amount of its own genome, and the gaps between ribbons are the accessory sequence: the widest one is Sakai's Shiga-toxin prophage, which has no K12 counterpart at all." src="/img/pangenome_cactus/boxed_locus_synteny.png" />

The [all-vs-all tutorial](/docs/tutorials/allvsall_synteny) covers the same
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

It downloads the same four RefSeq genomes as the pggb build, runs
`cactus-pangenome`, converts the HAL, VCF, `odgi depth`, and `odgi pav` into the
projections above, downloads JBrowse, and writes a `config.json` with the four
assemblies, per-strain gene tracks, the projection tracks above, and a default
session. It needs the same tools listed under [What you need](#what-you-need).

## See also

- [Pangenome graphs (pggb)](/docs/tutorials/pangenome_ecoli)
- [All-vs-all synteny](/docs/tutorials/allvsall_synteny)
- [MAF track](/docs/user_guides/maf_track)
- [Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md)
