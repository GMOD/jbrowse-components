#!/usr/bin/env bash
#
# Reproducibly build the E. coli Minigraph-Cactus pangenome-graph demo shown in
# website/docs/tutorials/pangenome_cactus.md: build a graph from four strains
# with `cactus-pangenome` and load its linear projections into a runnable
# JBrowse. The projections: all-vs-all synteny (halSynteny from the HAL),
# pangenome variants (`--vcf`), the whole-genome multiple alignment (the HAL,
# `hal2maf`, re-rooted on K12 as a MAF), pangenome depth (`odgi depth`, core vs
# accessory over K12 as a bigWig), and per-strain presence (`odgi pav`, one
# bigWig per strain as a MultiWiggle). It also maps a fifth isolate's short reads
# (E. coli KTa004, ENA DRR063408) through the graph with `--giraffe`/`vg giraffe`
# and surjects them onto K12, and copies the `--viz` odgi 1D raster as a figure.
#
# It downloads the same four RefSeq E. coli chromosomes as the pggb tutorial
# (build_ecoli_pangenome_graph.sh), so the two demos are a direct pggb-vs-MC
# comparison on identical input. Everything is pinned (fixed RefSeq accessions,
# pinned cactus image + parameters), so re-running reproduces the same graph.
#
# Unlike pggb (separate wfmash / seqwish / smoothxg / `-V` / `-M` steps),
# `cactus-pangenome` emits the graph (GFA/odgi), the VCF, and a HAL in one run;
# the projections below are derived from those outputs afterward.
#
# Requires: docker (the cactus image, which also carries odgi, halSynteny,
#           hal2maf, taffy, and vg), the NCBI `datasets` CLI, samtools,
#           bedGraphToBigWig (UCSC kentUtils), bgzip/tabix (htslib), unzip, wget,
#           ImageMagick (`convert`/`identify`, for the correspondence boxes),
#           and node (JBrowse CLI, via npx unless `jbrowse` is on PATH).
# Usage:    bash scripts/build_ecoli_pangenome_cactus.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-ecoli_cactus_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# Route temp files (sort, bedGraphToBigWig, bgzip, make-pif) onto the same real
# disk as the build. The default TMPDIR is often a small tmpfs `/tmp`, and the
# bigWig conversion can overflow it and fail mid-run. Override by exporting
# TMPDIR yourself before running.
export TMPDIR="${TMPDIR:-$PWD/tmp}"
mkdir -p "$TMPDIR"

STRAINS="K12 Sakai CFT073 NCTC86"
REF=K12          # the strain the VCF, MAF, and depth are projected onto
REFPATH="K12#0#chr"

# Pin the cactus image by tag (not :latest) so re-running reproduces the same
# graph. Bump deliberately, not silently. odgi, halSynteny, hal2maf, and taffy
# all ship inside this image, so the projections below reuse it.
CACTUS_IMAGE=quay.io/comparative-genomics-toolkit/cactus:v3.2.1
in_cactus() { docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data --env TMPDIR=/data/tmp "$CACTUS_IMAGE" "$@"; }

# ── Fetch each genome + annotation; keep only the chromosome, renamed `chr` ────
while read -r strain acc; do
  [ -f "$strain.zip" ] || datasets download genome accession "$acc" \
    --include genome,gff3 --filename "$strain.zip"
  unzip -o "$strain.zip" -d "$strain" >/dev/null
  awk '/^>/{n++; if (n == 1) print ">chr"; next} n == 1' \
    "$strain"/ncbi_dataset/data/*/*.fna > "$strain.fa"
done <<'STRAINS_TBL'
K12     GCF_000005845.2
Sakai   GCF_000008865.2
CFT073  GCF_000007445.1
NCTC86  GCF_003697165.2
STRAINS_TBL

# ── Build the graph with cactus-pangenome (Minigraph-Cactus) ──────────────────
# The seqFile maps each sample name to its FASTA (container paths under /data).
# Cactus applies PanSN `sample#haplotype#contig` naming internally, so the input
# contigs stay simply `chr`. --reference picks the path everything is projected
# onto. --vcf (vg deconstruct vs K12), --gfa/--gbz/--odgi (the graph), and --viz
# (the 1D odgi raster) are all produced in one run; a HAL (mc/ecoli.full.hal)
# falls out by default. Toil needs a fresh jobstore, so clear it on a re-run.
for strain in $STRAINS; do printf '%s\t/data/%s.fa\n' "$strain" "$strain"; done > seqfile.txt
if [ ! -f mc/ecoli.full.og ]; then
  rm -rf js
  in_cactus cactus-pangenome /data/js /data/seqfile.txt \
    --outDir /data/mc --outName ecoli --reference "$REF" \
    --vcf --gfa --gbz --odgi --viz --draw --giraffe \
    --consCores "$(getconf _NPROCESSORS_ONLN)" --workDir /data/tmp
fi

REFLEN=$(awk '!/^>/{c += length($0)} END{print c}' "$REF.fa")
printf 'chr\t%s\n' "$REFLEN" > chrom.sizes

# ── Projection 1: all-vs-all synteny (halSynteny from the HAL) ────────────────
# odgi untangle projects the graph to synteny too, but on this near-colinear
# bacterial graph its cut points are so sparse it collapses each pair to a few
# whole-chromosome blocks. halSynteny reads the HAL's base-level alignment and
# emits proper synteny blocks per pair (PSL). Its PSL names every sequence `chr`
# (no sample), so inject the PanSN `sample#0#chr` query/target names here — the
# AllVsAllIndexedPAFAdapter maps each record to its assembly by that prefix.
# halSynteny keeps the query on '+' and flips only the target strand, so the PAF
# strand is the 2nd char of PSL col 9 (`++` -> '+', `+-` -> '-').
: > ecoli_cactus_ava.paf
gen_pair() { # query target  (all 6 unordered pairs, target = the earlier strain)
  local q="$1" t="$2"
  in_cactus halSynteny --queryGenome "$q" --targetGenome "$t" \
    /data/mc/ecoli.full.hal "/data/hs_${t}_${q}.psl"
  awk -v OFS='\t' -v qn="${q}#0#chr" -v tn="${t}#0#chr" \
    '{ strand = (substr($9, 2, 1) == "-") ? "-" : "+";
       print qn, $11, $12, $13, strand, tn, $15, $16, $17, $1, ($13 - $12), 255 }' \
    "hs_${t}_${q}.psl" >> ecoli_cactus_ava.paf
}
gen_pair Sakai  K12
gen_pair CFT073 K12
gen_pair NCTC86 K12
gen_pair CFT073 Sakai
gen_pair NCTC86 Sakai
gen_pair NCTC86 CFT073

# ── Projection 2: pangenome variants (cactus-pangenome's --vcf) ───────────────
# cactus deconstructs the graph against K12 into mc/ecoli.vcf.gz. Its CHROM is
# already the assembly refName (`chr`) and its samples are the three non-K12
# strains, so it loads as-is — no rename step (pggb's -V needed one).

# ── Projection 3: whole-genome MAF, re-rooted on K12, as a bgzipped TAF ────────
# cactus-pangenome writes mc/ecoli.full.hal by default. hal2maf --refGenome roots
# every block on K12 directly (no reroot script), and the HAL's genome.sequence
# rows come out `K12.chr`/`Sakai.chr`/... — exactly the `sample.contig` names the
# MAF display splits species on. taffy converts it to the bgzipped-TAF JBrowse reads.
in_cactus hal2maf --refGenome "$REF" --noAncestors /data/mc/ecoli.full.hal /data/ecoli_cactus.maf
in_cactus taffy view -i /data/ecoli_cactus.maf -o /data/ecoli_cactus.taf.gz -c
in_cactus taffy index -i /data/ecoli_cactus.taf.gz

# ── Projection 4: pangenome depth (core vs accessory) as a bigWig ─────────────
# odgi depth counts how many path-steps traverse the graph nodes under each K12
# position: ~4 where all strains are present (core), dropping toward 1 where the
# stretch is K12-private (accessory). Tile K12 into 500 bp windows, rename the
# PanSN path to the assembly refName, and convert to bigWig.
awk -v p="$REFPATH" -v len="$REFLEN" -v w=500 \
  'BEGIN { for (s = 0; s < len; s += w) { e = s + w; if (e > len) e = len; print p "\t" s "\t" e } }' \
  > depth_windows.bed
in_cactus odgi depth -i /data/mc/ecoli.full.og -b /data/depth_windows.bed \
  | awk -v p="$REFPATH" -v OFS='\t' '$1 == p && $4 + 0 == $4 { print "chr", $2, $3, $4 }' \
  | sort -k1,1 -k2,2n > ecoli_cactus_depth.bedgraph
bedGraphToBigWig ecoli_cactus_depth.bedgraph chrom.sizes ecoli_cactus_depth.bw

# ── Projection 4b: per-strain presence/absence (odgi pav) as a MultiWiggle ─────
# odgi pav splits the aggregate depth per strain: for each K12 window and each
# strain, the fraction of that window the strain's path traverses (1 = present,
# ->0 = accessory/absent). pav's group column is the full PanSN path; the non-ref
# strains carry a trailing `#0` subpath tag (K12#0#chr but Sakai#0#chr#0).
in_cactus odgi pav -i /data/mc/ecoli.full.og -b /data/depth_windows.bed > pav.tsv
for strain in $STRAINS; do
  [ "$strain" = "$REF" ] && continue   # REF present over its own windows by construction
  group=$(awk -F'\t' -v s="$strain" 'NR > 1 && $5 ~ "^"s"#" {print $5; exit}' pav.tsv)
  awk -F'\t' -v OFS='\t' -v g="$group" \
    '$5 == g && $6 + 0 == $6 { print "chr", $2, $3, $6 }' pav.tsv \
    | sort -k1,1 -k2,2n > "ecoli_cactus_pav_${strain}.bedgraph"
  bedGraphToBigWig "ecoli_cactus_pav_${strain}.bedgraph" chrom.sizes "ecoli_cactus_pav_${strain}.bw"
done

# ── Graph overview: odgi viz (the "vs odgi viz" comparison figure) ────────────
# --viz already wrote mc/ecoli.viz/chr.full.viz.png, but its default layout is
# mostly link band. Re-render from the .og with tall path rows (-a 40) and a slim
# link band so the four strain rows dominate: one row per strain, x-axis = graph
# node order, colored by orientation. NOT a JBrowse track — the tutorial
# contrasts this graph-native axis against the reference-anchored projections.
# ecoli_cactus_graph_boxes.png (below) is what ships as
# website/static/img/pangenome_cactus/graph.png.
#
# -y is the LINK band, not the path rows. This bacterial graph is near-colinear
# and has almost no long-range links, so the old -y 200 spent 54% of the figure
# (measured: rows end at y=165 of 365) on an empty band. 20 keeps the band
# present — it is real graph structure when there is any — without letting
# emptiness dominate a figure whose point is the four strain rows.
VIZ_X=1500   # odgi viz data width in px; the label gutter is added to the left
in_cactus odgi viz -i /data/mc/ecoli.full.og -o /data/ecoli_cactus_graph.png -x "$VIZ_X" -a 40 -y 20

# ── Correspondence boxes: the same three loci on the graph axis and on K12 ────
# The raster's x axis is graph node order (pangenome bases), the JBrowse figures'
# is K12 bases, so nothing lines up between them by position alone. Box three
# loci in both, in the same three colors, and the correspondence becomes readable
# WITHOUT pretending the axes match — each box is visibly wider on the graph axis,
# because there the other strains' accessory sequence is counted too.
#
# The mapping is exact, not eyeballed: node ids in a cactus graph run 1..N in node
# order, so a node's pangenome offset is the cumulative length of every lower id,
# and walking K12's own P line gives K12 offset -> node -> pangenome offset. (That
# walk is monotonic here, which is what makes the graph axis interpretable at all;
# the awk below asserts it rather than assuming it.) Emits the K12 windows to
# graph_landmarks.tsv so website/scripts/specs/pangenome_cactus.ts can highlight
# the identical coordinates.
in_cactus odgi view -i /data/mc/ecoli.full.og -g > full.gfa
awk -v OFS='\t' -v vizx="$VIZ_X" '
  $1 == "S" { len[$2 + 0] = length($3); if ($2 + 0 > maxid) maxid = $2 + 0; next }
  $1 == "P" && $2 == "K12#0#chr" { k12 = $3; next }
  END {
    for (i = 1; i <= maxid; i++) { cum[i] = total; total += len[i] }
    n = split(k12, steps, ",")
    prev = -1
    for (i = 1; i <= n; i++) {
      id = steps[i] + 0
      kpos[i] = klen; pan[i] = cum[id]; klen += len[id]
      if (cum[id] < prev) { print "node order not monotonic along K12" > "/dev/stderr"; exit 1 }
      prev = cum[id]
    }
    print "#k12_start", "k12_end", "pan_start", "pan_end", "viz_x1", "viz_x2"
    split("1000000 2040000 3100000", starts, " ")
    for (w = 1; w <= 3; w++) {
      s = starts[w]; e = s + 100000
      ps = -1; pe = -1
      for (i = 1; i <= n; i++) {
        if (ps < 0 && kpos[i] + len[steps[i] + 0] > s) ps = pan[i] + (s - kpos[i])
        if (pe < 0 && kpos[i] + len[steps[i] + 0] > e) { pe = pan[i] + (e - kpos[i]); break }
      }
      print s, e, ps, pe, int(ps / total * vizx + 0.5), int(pe / total * vizx + 0.5)
    }
  }
' full.gfa > graph_landmarks.tsv
cat graph_landmarks.tsv

# Draw the boxes. The gutter is the rendered width minus the data width, so it
# follows odgi's own label layout instead of being hardcoded.
GUT=$(( $(identify -format '%w' ecoli_cactus_graph.png) - VIZ_X ))
H=$(identify -format '%h' ecoli_cactus_graph.png)
set -- '#1f77b4' '#ff7f0e' '#2ca02c'
ARGS=()
# columns: kstart kend pstart pend x1 x2; only the key and pixel span are used
while read -r ks _ _ _ x1 x2; do
  case "$ks" in \#*) continue;; esac
  ARGS+=(-stroke "$1" -strokewidth 5 -fill none
         -draw "rectangle $((GUT + x1)),1 $((GUT + x2)),$((H - 2))")
  shift
done < graph_landmarks.tsv
convert ecoli_cactus_graph.png "${ARGS[@]}" ecoli_cactus_graph_boxes.png

# ── Projection 5: map a new isolate's short reads through the graph ────────────
# Unlike every projection above (which re-plots the graph's own four genomes),
# this maps a FIFTH sample that is not in the graph. --giraffe made cactus emit
# vg giraffe's indexes (mc/ecoli.d2.gbz + .dist/.min/.zipcodes). Map E. coli
# KTa004 (ENA DRR063408, Illumina MiSeq) through the whole pangenome, then surject
# the graph alignment onto K12 as a plain BAM: a read over a non-K12 allele still
# has a graph path to sit on, so it places instead of mismatching against K12
# alone. Subsample to ~9x to keep the demo BAM small; drop unmapped reads.
READS_ACC=DRR063408
mkdir -p reads
for r in 1 2; do
  [ -f "reads/sub_$r.fastq.gz" ] && continue
  [ -f "reads/${READS_ACC}_$r.fastq.gz" ] || wget -qO "reads/${READS_ACC}_$r.fastq.gz" \
    "https://ftp.sra.ebi.ac.uk/vol1/fastq/${READS_ACC:0:6}/${READS_ACC}/${READS_ACC}_$r.fastq.gz"
  zcat "reads/${READS_ACC}_$r.fastq.gz" | head -600000 | gzip > "reads/sub_$r.fastq.gz"
done

in_cactus vg giraffe -p \
  -Z /data/mc/ecoli.d2.gbz -d /data/mc/ecoli.d2.dist \
  -m /data/mc/ecoli.d2.shortread.withzip.min -z /data/mc/ecoli.d2.shortread.zipcodes \
  -f /data/reads/sub_1.fastq.gz -f /data/reads/sub_2.fastq.gz > mapped.gam
in_cactus vg surject -x /data/mc/ecoli.d2.gbz -b -p "$REFPATH" \
  -N KTa004 -R KTa004 /data/mapped.gam > mapped.raw.bam
in_cactus samtools view -H /data/mapped.raw.bam | sed "s|SN:${REFPATH}|SN:chr|" > reads_hdr.sam
in_cactus samtools reheader /data/reads_hdr.sam /data/mapped.raw.bam > reads_reheader.bam
in_cactus samtools view -b -F 4 /data/reads_reheader.bam > reads_mapped.bam
in_cactus samtools sort -o /data/ecoli_cactus_reads.bam /data/reads_mapped.bam
in_cactus samtools index /data/ecoli_cactus_reads.bam

# ── Set up JBrowse (installed `jbrowse`, else the CLI via npx) ─────────────────
if command -v jbrowse >/dev/null 2>&1; then jb() { jbrowse "$@"; }; else jb() { npx -y @jbrowse/cli "$@"; }; fi
APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP"

# one assembly + gene track per strain (gene seqid renamed to `chr` like the FASTA)
for strain in $STRAINS; do
  bgzip -kf "$strain.fa"
  samtools faidx "$strain.fa.gz"
  jb add-assembly "$strain.fa.gz" --name "$strain" --load copy --force --out "$APP"
  acc=$(awk '/^>/{print substr($1, 2); exit}' "$strain"/ncbi_dataset/data/*/*.fna)
  awk -F'\t' -v acc="$acc" -v OFS='\t' '$1 == acc {$1 = "chr"; print}' \
    "$strain"/ncbi_dataset/data/*/genomic.gff > "$strain.gff"
  jb sort-gff "$strain.gff" | bgzip > "$strain.gff.gz"; tabix -f "$strain.gff.gz"
  jb add-track "$strain.gff.gz" --trackId "${strain}_genes" -a "$strain" \
    --name "$strain genes" --load copy --force --out "$APP"
done

AN=$(echo "$STRAINS" | sed 's/ /", "/g; s/^/"/; s/$/"/')

# projection 1: all-vs-all synteny. make-pif tabix-indexes the PAF so a range
# query fetches only the region in view; drop the pif beside config.json.
jb make-pif ecoli_cactus_ava.paf
cp ecoli_cactus_ava.pif.gz ecoli_cactus_ava.pif.gz.tbi "$APP/"
cat > ava_track.json <<JSON
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_cactus_ava",
  "name": "MC graph: all-vs-all synteny (halSynteny)",
  "assemblyNames": [$AN],
  "adapter": {
    "type": "AllVsAllIndexedPAFAdapter",
    "pifGzLocation": { "uri": "ecoli_cactus_ava.pif.gz" },
    "index": { "location": { "uri": "ecoli_cactus_ava.pif.gz.tbi" } },
    "assemblyNames": [$AN]
  }
}
JSON
jb add-track-json ava_track.json --update --out "$APP"

# projection 2: pangenome variants (matrix display by default)
cp mc/ecoli.vcf.gz "$APP/ecoli_cactus.vcf.gz"
cp mc/ecoli.vcf.gz.tbi "$APP/ecoli_cactus.vcf.gz.tbi"
cat > variants_track.json <<'JSON'
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
  "displays": [{ "type": "LinearMultiSampleVariantMatrixDisplay", "displayId": "ecoli_cactus_variants-matrix" }]
}
JSON
jb add-track-json variants_track.json --update --out "$APP"

# projection 3: whole-genome MAF (BgzipTaffyAdapter carries the sample list)
cp ecoli_cactus.taf.gz ecoli_cactus.taf.gz.tai "$APP/"
cat > maf_track.json <<'JSON'
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
JSON
jb add-track-json maf_track.json --update --out "$APP"

# projection 4: pangenome depth (autodetected as a QuantitativeTrack bigWig)
jb add-track ecoli_cactus_depth.bw --trackId ecoli_cactus_depth \
  --name "MC graph: pangenome depth (paths over K12)" -a K12 --load copy --force --out "$APP"

# projection 4b: per-strain presence (one bigWig per strain -> MultiQuantitativeTrack)
cp ecoli_cactus_pav_Sakai.bw ecoli_cactus_pav_CFT073.bw ecoli_cactus_pav_NCTC86.bw "$APP/"
cat > pav_track.json <<'JSON'
{
  "type": "MultiQuantitativeTrack",
  "trackId": "ecoli_cactus_pav",
  "name": "MC graph: per-strain presence (odgi pav, vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      { "type": "BigWigAdapter", "name": "Sakai",  "bigWigLocation": { "uri": "ecoli_cactus_pav_Sakai.bw" } },
      { "type": "BigWigAdapter", "name": "CFT073", "bigWigLocation": { "uri": "ecoli_cactus_pav_CFT073.bw" } },
      { "type": "BigWigAdapter", "name": "NCTC86", "bigWigLocation": { "uri": "ecoli_cactus_pav_NCTC86.bw" } }
    ]
  }
}
JSON
jb add-track-json pav_track.json --update --out "$APP"

# projection 5: KTa004 reads mapped through the graph, surjected onto K12
# (a standard BAM, so add-track autodetects it as an AlignmentsTrack)
jb add-track ecoli_cactus_reads.bam --trackId ecoli_cactus_reads \
  --name "KTa004 reads mapped through the graph (vs K12)" -a K12 --load copy --force --out "$APP"

# ── Default session: all four projections ─────────────────────────────────────
cat > session.json <<'JSON'
{
  "name": "E. coli Minigraph-Cactus pangenome graph",
  "views": [
    {
      "type": "LinearSyntenyView",
      "init": {
        "views": [
          { "assembly": "K12" },
          { "assembly": "Sakai" },
          { "assembly": "CFT073" },
          { "assembly": "NCTC86" }
        ],
        "tracks": [["ecoli_cactus_ava"], ["ecoli_cactus_ava"], ["ecoli_cactus_ava"]],
        "drawCurves": false,
        "minAlignmentLength": 10000
      }
    },
    {
      "type": "LinearGenomeView",
      "init": {
        "assembly": "K12",
        "loc": "chr:1,000,000-1,010,000",
        "tracks": ["K12_genes", "ecoli_cactus_reads", "ecoli_cactus_variants", "ecoli_cactus_maf", "ecoli_cactus_depth", "ecoli_cactus_pav"]
      }
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json with the four assemblies, gene tracks, the"
echo "Minigraph-Cactus projections (synteny, variants, MAF, depth, per-strain"
echo "presence), and the KTa004 read pileup mapped through the graph. Serve it:"
echo "  npx serve $(pwd)/$APP"
echo "The graph overview raster is ecoli_cactus_graph.png (odgi viz, from --viz)."
