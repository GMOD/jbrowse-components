#!/usr/bin/env bash
#
# Reproducibly build the E. coli Minigraph-Cactus pangenome-graph demo shown in
# website/docs/tutorials/pangenome_cactus.md: build a graph from five strains
# with `cactus-pangenome` and load its linear projections into a runnable
# JBrowse. The projections: all-vs-all synteny (halSynteny from the HAL),
# pangenome variants (`--vcf`), the whole-genome multiple alignment (the HAL,
# `hal2maf`, re-rooted on K12 as a MAF), pangenome depth (`odgi depth`, core vs
# accessory over K12 as a bigWig), and per-strain presence (`odgi pav`, one
# bigWig per strain as a MultiWiggle). It also maps a fifth isolate's short reads
# (E. coli KTa004, ENA DRR063408) through the graph with `--giraffe`/`vg giraffe`
# and surjects them onto K12, and copies the `--viz` odgi 1D raster as a figure.
# The graph itself goes in too, indexed by locus (build_pggb_tabix.sh) and drawn
# by the graph genome view plugin, which the config declares by url.
#
# It downloads the same five RefSeq E. coli chromosomes as the pggb tutorial
# (build_ecoli_pangenome_graph.sh), so the two demos are a direct pggb-vs-MC
# comparison on identical input. Everything is pinned (fixed RefSeq accessions,
# pinned cactus image + parameters), so re-running reproduces the same graph.
#
# Unlike pggb (separate wfmash / seqwish / smoothxg / `-V` / `-M` steps),
# `cactus-pangenome` emits the graph (GFA/odgi), the VCF, and a HAL in one run;
# the projections below are derived from those outputs afterward.
#
# Requires: docker or singularity (the cactus image, which also carries odgi,
#           halSynteny, hal2maf, and vg), the NCBI `datasets` CLI, samtools,
#           bedGraphToBigWig (UCSC kentUtils), python3, bgzip/tabix (htslib),
#           unzip, wget, ImageMagick (`convert`/`identify`, for the
#           correspondence band), and node (JBrowse CLI, via npx unless
#           `jbrowse` is on PATH).
# Usage:    bash scripts/build_ecoli_pangenome_cactus.sh [outdir]
#           CONTAINER=singularity bash scripts/build_ecoli_pangenome_cactus.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"   # so maf_to_bed.py resolves after cd

# Sibling helpers this script runs, fetched next to it when absent, so a bare
# `curl -fO` of this one file behaves the same as a repo checkout.
# build_pggb_tabix.sh fetches its own helper the same way.
HELPERS=(maf_to_bed.py build_pggb_tabix.sh)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUTDIR="${1:-ecoli_cactus_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# Route temp files (sort, bedGraphToBigWig, bgzip, make-pif) onto the same real
# disk as the build. The default TMPDIR is often a small tmpfs `/tmp`, and the
# bigWig conversion can overflow it and fail mid-run. Override by exporting
# TMPDIR yourself before running.
export TMPDIR="${TMPDIR:-$PWD/tmp}"
mkdir -p "$TMPDIR"

STRAINS="K12 Sakai CFT073 NCTC86 IAI39"
REF=K12          # the strain the VCF, MAF, and depth are projected onto
REFPATH="K12#0#chr"

# Pin the cactus image by tag (not :latest) so re-running reproduces the same
# graph. Bump deliberately, not silently. odgi, halSynteny, and hal2maf
# all ship inside this image, so the projections below reuse it.
CACTUS_IMAGE=quay.io/comparative-genomics-toolkit/cactus:v3.2.1

# docker if it is there, else singularity/apptainer, which is what a cluster
# usually has instead. Only this wrapper differs between the two: every `in_cactus`
# call below is unchanged, because `--bind`/`--pwd` are `-v`/`-w` and singularity
# already runs as the invoking user, so it needs no `-u`. Set CONTAINER to pick
# one explicitly.
CONTAINER="${CONTAINER:-}"
if [ -z "$CONTAINER" ]; then
  for c in docker singularity apptainer; do
    if command -v "$c" >/dev/null 2>&1; then CONTAINER="$c"; break; fi
  done
fi
case "$CONTAINER" in
  docker)
    in_cactus() { docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data --env TMPDIR=/data/tmp "$CACTUS_IMAGE" "$@"; } ;;
  singularity | apptainer)
    in_cactus() { "$CONTAINER" exec --cleanenv --bind "$PWD":/data --pwd /data --env TMPDIR=/data/tmp "docker://$CACTUS_IMAGE" "$@"; } ;;
  *)
    echo "need docker, singularity or apptainer on PATH to run $CACTUS_IMAGE" >&2
    exit 1 ;;
esac

# ── Fetch each genome + annotation; keep only the chromosome, renamed `chr` ────
# NCTC86 is GCF_002007705.1 (NZ_CP019778.1, 5,111,920 bp), the assembly the
# hosted demo was built from; GCF_003697165.2 is a different deposit of the same
# isolate (ATCC 11775, 4,903,501 bp) and would not line up with it.
#
# The cache is keyed on the ACCESSION and the unzip target is wiped first, so an
# edit to the table below takes effect on a machine that already ran this.
# Keyed on the strain name it would not: the old zip wins, and the old
# accession's directory survives under ncbi_dataset/data/ for the *.fna glob to
# find. The hosted ecoli_cactus_ava.pif.gz carries the wrong (4,903,501 bp)
# NCTC86 for exactly that reason and needs a rebuild.
while read -r strain acc; do
  zip="$strain.$acc.zip"
  [ -f "$zip" ] || datasets download genome accession "$acc" \
    --include genome,gff3 --filename "$zip"
  rm -rf "$strain"
  unzip -o "$zip" -d "$strain" >/dev/null
  awk '/^>/{n++; if (n == 1) print ">chr"; next} n == 1' \
    "$strain"/ncbi_dataset/data/*/*.fna > "$strain.fa"
done <<'STRAINS_TBL'
K12     GCF_000005845.2
Sakai   GCF_000008865.2
CFT073  GCF_000007445.1
NCTC86  GCF_002007705.1
IAI39   GCF_000026345.1
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
gen_pair() { # query target
  local q="$1" t="$2"
  in_cactus halSynteny --queryGenome "$q" --targetGenome "$t" \
    /data/mc/ecoli.full.hal "/data/hs_${t}_${q}.psl"
  awk -v OFS='\t' -v qn="${q}#0#chr" -v tn="${t}#0#chr" \
    '{ strand = (substr($9, 2, 1) == "-") ? "-" : "+";
       print qn, $11, $12, $13, strand, tn, $15, $16, $17, $1, ($13 - $12), 255 }' \
    "hs_${t}_${q}.psl" >> ecoli_cactus_ava.paf
}
# Every unordered pair once, target = the strain earlier in $STRAINS. Derived
# rather than listed: the pair count is quadratic (4 strains 6 pairs, 5 strains
# 10), so a hand-written list silently omits every pair involving a strain added
# to $STRAINS later.
i=0
for t in $STRAINS; do
  i=$((i + 1)); j=0
  for q in $STRAINS; do
    j=$((j + 1))
    if [ "$j" -gt "$i" ]; then
      gen_pair "$q" "$t"
    fi
  done
done

# ── Projection 2: pangenome variants (cactus-pangenome's --vcf) ───────────────
# cactus deconstructs the graph against K12 into mc/ecoli.vcf.gz. Its CHROM is
# already the assembly refName (`chr`) and its samples are the non-K12 strains,
# so it loads as-is — no rename step (pggb's -V needed one). cactus-pangenome
# runs vcfbub itself (--vcfbub, on by default), which is why nothing here has to
# pop the snarl tree the way the pggb build does.

# ── Projection 3: whole-genome MAF, re-rooted on K12, as a tabixed BED ─────────
# cactus-pangenome writes mc/ecoli.full.hal by default. hal2maf --refGenome roots
# every block on K12 directly (no reroot script), and the HAL's genome.sequence
# rows come out `K12.chr`/`Sakai.chr`/... — exactly the `sample.contig` names the
# MAF display splits species on. maf_to_bed.py writes the BED a MafTabixAdapter
# reads, one line per block carrying that block's rows.
in_cactus hal2maf --refGenome "$REF" --noAncestors /data/mc/ecoli.full.hal /data/ecoli_cactus.maf
python3 "$SCRIPT_DIR/maf_to_bed.py" ecoli_cactus.maf ecoli_cactus.maf.bed
bgzip -f ecoli_cactus.maf.bed
tabix -f -p bed ecoli_cactus.maf.bed.gz

# ── Projection 4: pangenome depth (core vs accessory) as a bigWig ─────────────
# odgi depth counts how many path-steps traverse the graph nodes under each K12
# position: near the strain count where every strain is present (core), dropping
# toward 1 where the stretch is K12-private (accessory). Tile K12 into 500 bp
# windows, rename the PanSN path to the assembly refName, and convert to bigWig.
# Steps, not strains: a repeat the graph collapsed would read above the strain
# count, as it does in the pggb build. Minigraph-Cactus keeps the rRNA copies
# apart, so this curve tops out at the strain count instead.
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

# ── The graph itself, browsable by locus (the two tabix indexes) ───────────────
# Every projection above flattens the graph onto K12; this indexes the graph so
# it can be drawn AS a graph, at any locus, with no per-window extraction step.
# Only the minigraph stage of Minigraph-Cactus writes rGFA, so mc/ecoli.gfa.gz
# carries no SN/SO/SR tags and pggb_gfa_to_bed.py's walk stands in for them: it
# derives each segment's reference interval from the path lines, and $REF anchors
# rank 0 on the K12 path. Cactus writes the reference as a P line and the
# haplotypes as W lines, which the walk reads alike; the trailing subpath tag on
# a non-reference path (Sakai#0#chr#0) changes nothing, since PanSN still
# resolves the sample. Emits the two BEDs RgfaTabixAdapter reads, so the region
# query, the subgraph cut, both anchored layouts, the launch menus and hover sync
# all work off these. Host-side (python3 only, no container).
# --gfa writes mc/ecoli.gfa.gz; fall back to whatever GFA the run did write, so
# a cactus bump that renames it fails in build_pggb_tabix.sh with the name it
# looked for rather than here with a glob.
GRAPH_GFA=mc/ecoli.gfa.gz
[ -f "$GRAPH_GFA" ] || GRAPH_GFA=$(ls mc/*.gfa.gz | awk 'NR <= 1')
bash "$SCRIPT_DIR/build_pggb_tabix.sh" "$GRAPH_GFA" ecoli_cactus "$REF"

# ── Graph overview: odgi viz (the "vs odgi viz" comparison figure) ────────────
# --viz already wrote mc/ecoli.viz/chr.full.viz.png, but its default layout is
# mostly link band. Re-render from the .og with tall path rows (-a 40) and a slim
# link band so the four strain rows dominate: one row per strain, x-axis = graph
# node order, colored by orientation. NOT a JBrowse track — the tutorial
# contrasts this graph-native axis against the reference-anchored projections.
# ecoli_cactus_graph_boxes.png (below) is what ships as
# website/static/img/pangenome_cactus/graph.png.
#
# -y is the TOTAL image height, not the link band, but odgi expands past it to
# fit the path rows, so in practice it sets how much room is left underneath
# them for the links. This bacterial graph is near-colinear
# and has almost no long-range links, so the old -y 200 spent 54% of the figure
# (measured: rows end at y=165 of 365) on an empty band. 20 keeps the band
# present — it is real graph structure when there is any — without letting
# emptiness dominate a figure whose point is the four strain rows.
VIZ_X=1500   # odgi viz data width in px; the label gutter is added to the left
in_cactus odgi viz -i /data/mc/ecoli.full.og -o /data/ecoli_cactus_graph.png -x "$VIZ_X" -a 40 -y 20

# ── Correspondence band: one locus on the graph axis and on K12 ───────────────
# The raster's x axis is graph node order (pangenome bases), the JBrowse figures'
# is K12 bases, so nothing lines up between them by position alone. Shade ONE
# locus in both, in the same translucent gold, and the correspondence becomes
# readable WITHOUT pretending the axes match — the band is visibly wider on the
# graph axis, because there the other strains' accessory sequence is counted too.
# K12 1.00-1.10 Mb is the widest of the candidate windows. On the shipped
# raster the band measures 64 of the 1500 data px, 4.3% of the graph axis
# against 2.2% of the K12 axis (100 kb of 4,641,652), so roughly 2x. An earlier
# comment here claimed 466 kb / 5.1% / 2.4x; that does not match the PNG in
# static/img/pangenome_cactus/graph.png, so re-measure before quoting a number.
#
# The mapping is exact, not eyeballed: node ids in a cactus graph run 1..N in node
# order, so a node's pangenome offset is the cumulative length of every lower id,
# and walking K12's own P line gives K12 offset -> node -> pangenome offset.
#
# What has to hold is that the window's K12 bases land on a CONTIGUOUS run of
# pangenome offsets, and the awk asserts exactly that. It used to assert the
# stronger property that K12's whole path is monotonic in node order, which held
# for four strains and stops holding at five: K12's path takes exactly one
# backward step out of 362,720, at K12 1,652,761, jumping from pangenome offset
# 9,198,811 back to 3,598,999 (the graph is 9,203,584 bp). One discontinuity in a
# circular genome is an origin wrap, not a rearrangement, and the landmark window
# sits on one side of it. Asserting globally would reject a graph the figure can
# represent perfectly well; asserting per window rejects only the case that would
# actually draw a wrong band.
#
# Emits the K12 window to graph_landmarks.tsv so
# website/scripts/specs/pangenome_cactus.ts can highlight the identical
# coordinates.
in_cactus odgi view -i /data/mc/ecoli.full.og -g > full.gfa
awk -v OFS='\t' -v vizx="$VIZ_X" '
  $1 == "S" { len[$2 + 0] = length($3); if ($2 + 0 > maxid) maxid = $2 + 0; next }
  $1 == "P" && $2 == "K12#0#chr" { k12 = $3; next }
  END {
    for (i = 1; i <= maxid; i++) { cum[i] = total; total += len[i] }
    n = split(k12, steps, ",")
    for (i = 1; i <= n; i++) {
      id = steps[i] + 0
      kpos[i] = klen; pan[i] = cum[id]; slen[i] = len[id]; klen += len[id]
    }
    print "#k12_start", "k12_end", "pan_start", "pan_end", "viz_x1", "viz_x2"
    s = 1000000; e = s + 100000
    ps = -1; pe = -1; prev = -1
    for (i = 1; i <= n; i++) {
      if (kpos[i] + slen[i] > s && kpos[i] < e) {
        if (pan[i] < prev) {
          printf "K12 %d-%d straddles a node-order discontinuity; pick another window\n", s, e > "/dev/stderr"
          exit 1
        }
        prev = pan[i]
        if (ps < 0) ps = pan[i] + (s - kpos[i])
        if (pe < 0 && kpos[i] + slen[i] > e) pe = pan[i] + (e - kpos[i])
      }
    }
    print s, e, ps, pe, int(ps / total * vizx + 0.5), int(pe / total * vizx + 0.5)
  }
' full.gfa > graph_landmarks.tsv
cat graph_landmarks.tsv

# Shade the band. Translucent fill rather than an outline: a 5px stroke over a
# 40px-per-row raster of saturated magenta/green/orange reads as one more block
# edge, which is what the review said. The gutter is the rendered width minus the
# data width, so it follows odgi's own label layout instead of being hardcoded.
# Gold is the identical paint the JBrowse figure's `highlight` uses, so the two
# images are literally the same wash over the same locus. It is the one hue that
# survives both backgrounds — this raster's magenta/green/orange rows on white,
# and the solid dark blue of the depth track over there.
GUT=$(( $(identify -format '%w' ecoli_cactus_graph.png) - VIZ_X ))
H=$(identify -format '%h' ecoli_cactus_graph.png)
read -r _ _ _ _ X1 X2 < <(tail -n1 graph_landmarks.tsv)
convert ecoli_cactus_graph.png -fill 'rgba(255,193,7,0.60)' -stroke none \
  -draw "rectangle $((GUT + X1)),0 $((GUT + X2)),$((H - 1))" \
  ecoli_cactus_graph_boxes.png

# ── Projection 5: map a new isolate's short reads through the graph ────────────
# Unlike every projection above (which re-plots the graph's own genomes), this
# maps a sample that is NOT in the graph at all. --giraffe made cactus emit
# vg giraffe's indexes (mc/ecoli.d2.gbz + .dist/.min/.zipcodes). Map E. coli
# KTa004 (ENA DRR063408, Illumina MiSeq) through the whole pangenome, then surject
# the graph alignment onto K12 as a plain BAM: a read over a non-K12 allele still
# has a graph path to sit on, so it places instead of mismatching against K12
# alone. Subsample to ~9x to keep the demo BAM small; drop unmapped reads.
READS_ACC=DRR063408
mkdir -p reads
for r in 1 2; do
  [ -f "reads/sub_$r.fastq.gz" ] && continue
  # -nv not -q, and retries: these are ~90 MB each off a public FTP mirror, and a
  # silent `wget -q` failure here aborts the whole run under `set -e` with no
  # message at all, after the graph has already been built.
  [ -f "reads/${READS_ACC}_$r.fastq.gz" ] || wget -nv --tries=5 --continue \
    -O "reads/${READS_ACC}_$r.fastq.gz" \
    "https://ftp.sra.ebi.ac.uk/vol1/fastq/${READS_ACC:0:6}/${READS_ACC}/${READS_ACC}_$r.fastq.gz"
  # awk does the head: `| head -600000` closes the pipe on gzip, which dies of
  # SIGPIPE, and under `set -o pipefail` that aborts the run after the reads
  # are already downloaded.
  gzip -dc "reads/${READS_ACC}_$r.fastq.gz" |
    awk 'NR<=600000' | gzip > "reads/sub_$r.fastq.gz"
done

# vg refuses to map when an index is older than something it depends on, and
# giraffe itself rewrites ecoli.d2.dist as it runs. So the FIRST run leaves .dist
# newer than the .min/.zipcodes built from it, and a re-run of this script then
# dies with "is newer than ... which depends on it". The indexes are fine; only
# the mtimes are misleading, so restamp the derived ones before mapping.
touch mc/ecoli.d2.shortread.withzip.min mc/ecoli.d2.shortread.zipcodes
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

# projection 3: whole-genome MAF (MafTabixAdapter carries the sample list)
cp ecoli_cactus.maf.bed.gz ecoli_cactus.maf.bed.gz.tbi "$APP/"
cat > maf_track.json <<'JSON'
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
JSON
jb add-track-json maf_track.json --update --out "$APP"

# projection 4: pangenome depth (autodetected as a QuantitativeTrack bigWig)
jb add-track ecoli_cactus_depth.bw --trackId ecoli_cactus_depth \
  --name "MC graph: pangenome depth (paths over K12)" -a K12 --load copy --force --out "$APP"

# projection 4b: per-strain presence (one bigWig per strain -> MultiQuantitativeTrack)
# Derived from $STRAINS rather than listed, like $AN above: a hand-written list
# silently drops whichever strain it was written before. It used to name three of
# the four the loop generates, so IAI39's bigWig was built and then left out of
# the track, and this build disagreed with the hosted demo and with the figure in
# the tutorial.
for strain in $STRAINS; do
  [ "$strain" = "$REF" ] || cp "ecoli_cactus_pav_$strain.bw" "$APP/"
done
SUBS=$(for strain in $STRAINS; do
  [ "$strain" = "$REF" ] && continue
  printf '      { "type": "BigWigAdapter", "name": "%s", "bigWigLocation": { "uri": "ecoli_cactus_pav_%s.bw" } },\n' "$strain" "$strain"
done | sed '$ s/,$//')
cat > pav_track.json <<JSON
{
  "type": "MultiQuantitativeTrack",
  "trackId": "ecoli_cactus_pav",
  "name": "MC graph: per-strain presence (odgi pav, vs $REF)",
  "assemblyNames": ["$REF"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
$SUBS
    ]
  }
}
JSON
jb add-track-json pav_track.json --update --out "$APP"

# projection 5: KTa004 reads mapped through the graph, surjected onto K12
# (a standard BAM, so add-track autodetects it as an AlignmentsTrack)
jb add-track ecoli_cactus_reads.bam --trackId ecoli_cactus_reads \
  --name "KTa004 reads mapped through the graph (vs K12)" -a K12 --load copy --force --out "$APP"

# the graph itself: RgfaTabixAdapter reads the two indexes built above; its `uri`
# is the shared prefix, and it resolves `.segs.bed.gz`/`.links.bed.gz` and their
# `.tbi`. The graph's stable names are PanSN and the sample prefix already equals
# the assembly name, so no assemblyNameToPanSN mapping is needed. Needs the four
# files beside config.json, since add-track-json copies nothing.
cp ecoli_cactus.segs.bed.gz ecoli_cactus.segs.bed.gz.tbi \
   ecoli_cactus.links.bed.gz ecoli_cactus.links.bed.gz.tbi "$APP/"
cat > segments_track.json <<'JSON'
{
  "type": "FeatureTrack",
  "trackId": "ecoli_cactus_segments",
  "name": "MC graph: segments (whole graph, by locus)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "ecoli_cactus"
  },
  "displays": [{ "type": "LinearBasicDisplay", "showLabels": false }]
}
JSON
jb add-track-json segments_track.json --update --out "$APP"

# The adapter and the view both come from the graph genome view plugin, which is
# not bundled in JBrowse Web and has no CLI command, so declare it directly. It
# is a native ES module loaded at runtime from its own url. Without this the
# track above loads nothing and its Launch menu item is absent.
python3 - "$APP/config.json" <<'PY'
import json, sys

path = sys.argv[1]
with open(path) as fh:
    config = json.load(fh)
plugins = config.setdefault('plugins', [])
name = 'GraphGenomeView'
if not any(p.get('name') == name for p in plugins):
    plugins.append({
        'name': name,
        'esmUrl': 'https://jbrowse.org/demos/graphgenomeviewer/jbrowse-plugin-graphgenomeviewer.esm.js',
    })
with open(path, 'w') as fh:
    json.dump(config, fh, indent=2)
PY

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
          { "assembly": "NCTC86" },
          { "assembly": "IAI39" }
        ],
        "tracks": [["ecoli_cactus_ava"], ["ecoli_cactus_ava"], ["ecoli_cactus_ava"], ["ecoli_cactus_ava"]],
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
echo "Built $APP/config.json with the $(echo "$STRAINS" | wc -w) assemblies, gene tracks, the"
echo "Minigraph-Cactus projections (synteny, variants, MAF, depth, per-strain"
echo "presence), the KTa004 read pileup mapped through the graph, and the graph"
echo "itself as a segments track. Serve it:"
echo "  npx serve $(pwd)/$APP"
echo "Turn on 'MC graph: segments' and use its track menu's Launch to draw"
echo "any window as a graph; the config declares the plugin that does it."
echo "The graph overview raster is ecoli_cactus_graph.png (odgi viz, from --viz)."
