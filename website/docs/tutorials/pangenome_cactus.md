---
title: Pangenome graphs with Minigraph-Cactus
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
[pggb tutorial](/docs/tutorials/pangenome) and loads the same four linear
projections onto the K12 reference, so the two are a side-by-side comparison of
the builders on identical input. The pggb tutorial explains what each projection
_means_; this one focuses on producing them from Minigraph-Cactus. What differs:

| Step             | pggb                                        | Minigraph-Cactus                                                     |
| ---------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| Build            | wfmash + seqwish + smoothxg, then `-V`/`-M` | one `cactus-pangenome` run emits the graph, VCF, odgi, and a HAL     |
| Reference        | symmetric all-vs-all, `-V` picks a path     | explicit `--reference`; the minigraph backbone is that genome        |
| Variants         | `pggb -V`, CHROM is the PanSN path          | `--vcf` (vg deconstruct), CHROM already the reference contig         |
| Whole-genome MAF | `pggb -M`, re-rooted on the reference       | the HAL, `hal2maf --refGenome` (already reference-rooted)            |
| Synteny          | the wfmash all-vs-all PAF                   | `halSynteny` from the HAL (or `odgi untangle`)                       |
| Depth / presence | `odgi depth` / `odgi pav`                   | same (odgi ships in the cactus image)                                |
| Read mapping     | not available (graph's own genomes only)    | `--giraffe` indexes let `vg giraffe` map new reads, surjected to K12 |

Every projection lands on a JBrowse track type you already have. The four are
laid out in the [pggb tutorial's projection table](/docs/tutorials/pangenome);
the sections below build each from the Cactus outputs.

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
every projection is decomposed against:

```bash
docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data \
  quay.io/comparative-genomics-toolkit/cactus:v3.2.1 \
  cactus-pangenome /data/js /data/seqfile.txt \
    --outDir /data/mc --outName ecoli --reference K12 \
    --vcf --gfa --gbz --odgi --viz --draw --giraffe --consCores 8
```

Pinning the image to a dated version tag (not `:latest`) keeps the graph
reproducible. `/data/js` is the [Toil](https://toil.readthedocs.io/) job store
(must not already exist on a fresh run); `--outName ecoli` prefixes every
output. The one flag that is easy to miss is `--vcf`: without it Cactus builds
the graph but never deconstructs it, so the variant projection has no input.
`--odgi` writes the `.og` the depth and presence projections read, `--viz`
writes the odgi 1D raster shown at the end, and `--giraffe` writes the
short-read mapping indexes the
[read-mapping section](#mapping-short-reads-through-the-graph) uses.

A single run emits everything the sections below use:

- `mc/ecoli.gfa.gz`, `mc/ecoli.full.og`: the graph (GFA and odgi)
- `mc/ecoli.vcf.gz`: the pangenome variants
- `mc/ecoli.full.hal`: the multiple alignment as a HAL (the synteny and MAF
  projections read this)
- `mc/ecoli.d2.gbz`, `mc/ecoli.d2.dist`, `mc/ecoli.d2.shortread.withzip.min`,
  `mc/ecoli.d2.shortread.zipcodes`: the `vg giraffe` mapping indexes
- `mc/ecoli.viz/chr.full.viz.png`: the odgi 1D graph raster

The cactus image also carries [odgi](https://github.com/pangenome/odgi),
`halSynteny`, `hal2maf`, and
[taffy](https://github.com/ComparativeGenomicsToolkit/taffy), so no other tool
is needed for the projections. Every `in_cactus` command below is that same
`docker run … cactus:v3.2.1` wrapper.

## All-vs-all synteny projection

Cactus does not emit an all-vs-all alignment PAF the way pggb's wfmash step
does. Two graph outputs can stand in. `odgi untangle` projects the graph to a
synteny PAF, but on a near-colinear bacterial graph its cut points are sparse
and it collapses each pair to a few whole-chromosome blocks.
[`halSynteny`](https://github.com/ComparativeGenomicsToolkit/hal) instead reads
the HAL's base-level alignment and emits proper synteny blocks per genome pair,
so use it here.

`halSynteny` writes PSL and names every sequence `chr` (the HAL sequence name),
with no sample tag, so inject the PanSN `sample#0#chr` query/target names as you
convert PSL to PAF. It keeps the query on `+` and flips only the target strand,
so the PAF strand is the second character of the PSL strand field:

```bash
: > ecoli_cactus_ava.paf
gen_pair() {   # query target
  in_cactus halSynteny --queryGenome "$1" --targetGenome "$2" \
    /data/mc/ecoli.full.hal "/data/hs_$2_$1.psl"
  awk -v OFS='\t' -v qn="$1#0#chr" -v tn="$2#0#chr" \
    '{ s = (substr($9,2,1)=="-") ? "-" : "+";
       print qn,$11,$12,$13,s,tn,$15,$16,$17,$1,($13-$12),255 }' \
    "hs_$2_$1.psl" >> ecoli_cactus_ava.paf
}
for pair in "Sakai K12" "CFT073 K12" "NCTC86 K12" \
            "CFT073 Sakai" "NCTC86 Sakai" "NCTC86 CFT073"; do
  gen_pair $pair
done
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
    "vcfGzLocation": { "uri": "ecoli_cactus.vcf.gz" },
    "index": { "location": { "uri": "ecoli_cactus.vcf.gz.tbi" } }
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

These two projections are byte-for-byte the same commands as the pggb tutorial's
[depth](/docs/tutorials/pangenome#pangenome-depth-projection-core-vs-accessory)
and [per-strain presence](/docs/tutorials/pangenome#per-strain-presence)
sections, run on the Cactus `.og` instead of the pggb GFA, because odgi ships in
the cactus image. The one difference is the path names: the reference path is
`K12#0#chr`, and the non-reference strains carry a trailing subpath tag
(`Sakai#0#chr#0`), so filter on those.

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

<Figure caption="odgi depth across all 4.64 Mb of K12 from the Minigraph-Cactus graph. The curve sits near 4 where all four strains traverse the graph (core sequence) and drops toward 1 over the accessory stretches private to fewer strains." src="/img/pangenome_cactus/depth.png" />

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
[pggb tutorial's `odgi viz` section](/docs/tutorials/pangenome#compared-to-odgi-viz)
explains that trade-off in full; it applies identically here, because both
builders produce the same kind of graph and the same odgi renders it.

<Figure caption="The four-strain Minigraph-Cactus graph drawn by odgi viz (--viz): one row per strain, colored where that strain traverses the graph and white where it does not. The horizontal axis is graph node order, not K12 position, so nothing lines up with a gene or coordinate. The four JBrowse projections re-plot this same presence/absence on K12's coordinates." src="/img/pangenome_cactus/graph.png" />

## Mapping short reads through the graph

Every section above projects the graph's own four genomes onto K12. This does
what pggb's outputs cannot: it maps **a new sample, not in the graph**, through
it. `--giraffe` makes `cactus-pangenome` emit the
[`vg giraffe`](https://github.com/vgteam/vg/wiki/Mapping-short-reads-with-Giraffe)
short-read indexes (`mc/ecoli.d2.gbz` and its `.dist`/`.min`/`.zipcodes`), so
reads align against the whole pangenome instead of against K12 alone. A read
over a non-K12 allele still has a graph path to sit on (the one another strain
contributed), so it places cleanly instead of mismatching against K12.
`vg surject` then rewrites each alignment in K12 coordinates as a plain BAM.

Grab reads from a real isolate not in the graph,
[_E. coli_ KTa004](https://www.ebi.ac.uk/ena/browser/view/DRR063408) (ENA
`DRR063408`, Illumina MiSeq). 150k pairs is ~9× over the 4.6 Mb genome:

```bash
mkdir -p reads
for r in 1 2; do
  wget -qO "reads/DRR063408_$r.fastq.gz" \
    "https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR063/DRR063408/DRR063408_$r.fastq.gz"
  zcat "reads/DRR063408_$r.fastq.gz" | head -600000 | gzip > "reads/sub_$r.fastq.gz"
done
```

Map through the graph, then surject the alignments onto the K12 path:

```bash
in_cactus vg giraffe -p \
  -Z /data/mc/ecoli.d2.gbz -d /data/mc/ecoli.d2.dist \
  -m /data/mc/ecoli.d2.shortread.withzip.min -z /data/mc/ecoli.d2.shortread.zipcodes \
  -f /data/reads/sub_1.fastq.gz -f /data/reads/sub_2.fastq.gz > mapped.gam

in_cactus vg surject -x /data/mc/ecoli.d2.gbz -b -p "K12#0#chr" \
  -N KTa004 -R KTa004 /data/mapped.gam > mapped.raw.bam
```

`surject` labels the reference by its PanSN path (`K12#0#chr`); rename it to the
`chr` contig, drop unmapped reads, and sort:

```bash
in_cactus bash -c '
  samtools view -H /data/mapped.raw.bam | sed "s/SN:K12#0#chr/SN:chr/" > /data/hdr.sam
  samtools reheader /data/hdr.sam /data/mapped.raw.bam \
    | samtools view -b -F 4 - \
    | samtools sort -o /data/ecoli_cactus_reads.bam
  samtools index /data/ecoli_cactus_reads.bam'
```

The BAM is a standard format, so `jbrowse add-track` autodetects it as an
[`AlignmentsTrack`](/docs/config_guides/alignments_track) on K12:

```bash
jbrowse add-track ecoli_cactus_reads.bam --name "KTa004 reads (vs K12)" -a K12
```

<Figure caption="KTa004 reads (a fifth isolate, not in the graph) mapped through the Minigraph-Cactus pangenome with vg giraffe and surjected onto K12, stacked above the same locus's pangenome variant matrix and MAF. The reads were placed by the whole graph, then re-expressed in K12 coordinates, so the pileup lines up directly under the projections." src="/img/pangenome_cactus/reads.png" />

An ordinary pileup (coverage, mismatches, mapping quality), but placed by the
whole pangenome rather than K12 alone, so it stacks on the same coordinates as
the projections. The
[alignments track guide](/docs/user_guides/alignments_track) covers the pileup,
coverage, and sort/color options.

`vg surject` also takes several `-p` paths at once (or `-F` with a file of
them), so where each strain has a full-length path you can project the same
reads onto each one, load a track per assembly, and stack them in a
[linear synteny view](/docs/tutorials/allvsall_synteny) to see how the reads
land across strains. Here only K12 is a full-length path (the others are stored
as subpaths), so K12 makes the cleanest track.

## Reproduce it end to end

[`build_ecoli_pangenome_cactus.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ecoli_pangenome_cactus.sh)
runs everything above in one shot:

```bash
bash scripts/build_ecoli_pangenome_cactus.sh   # builds ./ecoli_cactus_build/jbrowse2
npx --yes serve ecoli_cactus_build/jbrowse2
```

It downloads the same four RefSeq genomes as the pggb build, runs
`cactus-pangenome` (with `--giraffe`), converts the HAL, VCF, `odgi depth`, and
`odgi pav` into the projections above, maps the KTa004 reads through the graph
and surjects them onto K12, downloads JBrowse, and writes a `config.json` with
the four assemblies, per-strain gene tracks, the five graph projections plus the
read pileup, and a default session. It needs `docker` (the cactus image, which
carries odgi/halSynteny/hal2maf/taffy and `vg`/`samtools`), the NCBI
[`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
CLI, `bedGraphToBigWig` (UCSC kentUtils), htslib (`bgzip`, `tabix`), `unzip`,
`wget`, and `node`.

## See also

- [Pangenome graphs (pggb)](/docs/tutorials/pangenome)
- [Synteny all-vs-all](/docs/tutorials/allvsall_synteny)
- [MAF track](/docs/user_guides/maf_track)
- [vg giraffe](https://github.com/vgteam/vg/wiki/Mapping-short-reads-with-Giraffe)
- [Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md)
