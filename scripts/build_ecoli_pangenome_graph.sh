#!/usr/bin/env bash
#
# Reproducibly build the E. coli pangenome-graph demo shown in
# website/docs/tutorials/pangenome.md: build a pggb graph from four strains and
# load its linear projections into a runnable JBrowse — the all-vs-all synteny
# (wfmash PAF), the pangenome variants (`pggb -V`), the whole-genome multiple
# alignment (`pggb -M`, re-rooted on K12 as a MAF), the pangenome depth (`odgi
# depth`, core vs accessory over K12 as a bigWig), and per-strain presence
# (`odgi pav`, one bigWig per strain as a MultiWiggle). It also writes the `odgi
# viz` graph raster as a static comparison figure.
#
# It downloads the same four RefSeq E. coli chromosomes as the all-vs-all synteny
# tutorial, PanSN-names a concatenated copy, runs pggb, converts each output to
# the format its JBrowse track type reads, and writes a config.json with the four
# assemblies, per-strain gene tracks, the five graph-derived tracks, and a
# default session (a stacked synteny view plus the K12 reference lane).
#
# Everything is pinned (fixed RefSeq accessions, pinned pggb image + parameters),
# so re-running reproduces the same graph and views.
#
# Requires: docker (the pggb image, which also carries odgi for the depth
#           projection), the NCBI `datasets` CLI, samtools, taffy (the
#           Cactus/taffy toolkit), bedGraphToBigWig (UCSC kentUtils), python3,
#           bgzip/tabix (htslib), unzip, and node (JBrowse CLI, via npx unless
#           `jbrowse` is on PATH).
# Usage:    bash scripts/build_ecoli_pangenome_graph.sh [outdir]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"   # so reroot_maf.py resolves after cd
OUTDIR="${1:-ecoli_pangenome_graph_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# Route temp files (sort, bedGraphToBigWig, bgzip, make-pif) onto the same real
# disk as the build. The default TMPDIR is often a small tmpfs `/tmp`, and the
# all-vs-all PAF sort and bigWig conversion can overflow it and fail mid-run.
# Override by exporting TMPDIR yourself before running.
export TMPDIR="${TMPDIR:-$PWD/tmp}"
mkdir -p "$TMPDIR"

STRAINS="K12 Sakai CFT073 NCTC86"
REF=K12   # the strain the VCF and MAF are projected onto

# Pin the pggb image by tag (pggb's dated build tag, not :latest) so re-running
# reproduces the same graph. Bump this to a newer tag deliberately, not silently.
# odgi ships inside this image, so the depth projection below reuses it.
PGGB_IMAGE=ghcr.io/pangenome/pggb:202603141454453ade6b
in_pggb() { docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data "$PGGB_IMAGE" "$@"; }

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

# ── PanSN-name (sample#haplotype#contig) a concatenated copy for pggb ─────────
# haplotype is always `1` (haploid bacterial assemblies); pggb reads the PanSN
# `sample#` prefix to tell which genome each sequence belongs to.
for strain in $STRAINS; do
  awk -v s="$strain" '/^>/{print ">" s "#1#chr"; next} {print}' "$strain.fa"
done > all.fa
bgzip -kf all.fa
samtools faidx all.fa.gz

# ── Build the graph with pggb ────────────────────────────────────────────────
# -n <#haplotypes>, -p 90 / -s 5000 (identity/segment for a bacterial pangenome),
# -V REF makes a VCF decomposing variants against the REF path, -M writes a MAF.
# -c <#haplotypes - 1> is REQUIRED for a real all-vs-all: pggb's separate
# `-c, --n-mappings` defaults to 1, so `-n 4` alone makes wfmash keep only each
# segment's single best match (one other genome), yielding an under-connected
# graph that crashes smoothxg (std::length_error / segfault in graph prep). Set
# -c so every segment maps to all other haplotypes.
# -w /data gives the mapped -u user a writable working directory; without it
# seqwish cannot write its sdsl temp files (cwd defaults to `/`) and dies.
NHAP=$(echo "$STRAINS" | wc -w)
if ! ls pggb/*.smooth.final.gfa >/dev/null 2>&1; then
  in_pggb pggb -i /data/all.fa.gz -o /data/pggb \
    -n "$NHAP" -c "$((NHAP - 1))" -t "$(nproc)" -p 90 -s 5000 -V "$REF" -M
fi

GFA=$(ls pggb/*.smooth.final.gfa)

# ── Projection 1: all-vs-all synteny (the wfmash PAF pggb already produced) ───
# make-pif tabix-indexes it so the whole-genome view stays a range query.
cp pggb/*.alignments.wfmash.paf ecoli_pggb_ava.paf
jbrowse make-pif ecoli_pggb_ava.paf   # -> ecoli_pggb_ava.pif.gz (+ .tbi)

# ── Projection 2: pangenome variants (rename the REF path to the assembly chr) ─
# pggb writes the VCF CHROM as the PanSN reference path (K12#1#chr); JBrowse needs
# it to match the K12 assembly's refName (chr). The VCF is already position
# sorted, so a rename + bgzip + tabix is all it takes.
sed "s/${REF}#1#chr/chr/g" pggb/*.smooth.final."$REF".vcf | bgzip > ecoli_pggb.vcf.gz
tabix -f -p vcf ecoli_pggb.vcf.gz

# ── Projection 3: whole-genome MAF, re-rooted on REF, as a bgzipped TAF ───────
# pggb's -M MAF orders each block from its longest path, so row 0 is not a fixed
# reference; JBrowse indexes a MAF on row 0, so re-root every block on REF (drop
# blocks that lack it, flip blocks where REF is on '-'), then rename PanSN
# 'sample#1#chr' -> 'sample.chr' (JBrowse splits the species off on the '.').
python3 "$SCRIPT_DIR/reroot_maf.py" "$(ls pggb/*.smooth.maf)" ecoli_pggb.maf "${REF}#1#chr"
taffy view -i ecoli_pggb.maf -o ecoli_pggb.taf.gz -c
taffy index -i ecoli_pggb.taf.gz

# ── Projection 4: pangenome depth (core vs accessory) as a bigWig ─────────────
# odgi depth counts how many path-steps traverse the graph nodes under each REF
# position: ~n where all strains are present (core), dropping toward 1 where the
# stretch is REF-private (accessory). odgi ships in the pggb image, so reuse it.
# Tile REF into 500 bp windows, ask odgi for each window's mean depth, rename the
# PanSN path to the assembly refName, and convert to bigWig for a wiggle track.
# (Repeats can push a window's depth above the strain count.)
REFLEN=$(awk -v p="${REF}#1#chr" '$1 == p {print $2}' all.fa.gz.fai)
awk -v p="${REF}#1#chr" -v len="$REFLEN" -v w=500 \
  'BEGIN { for (s = 0; s < len; s += w) { e = s + w; if (e > len) e = len; print p "\t" s "\t" e } }' \
  > depth_windows.bed
in_pggb odgi depth -i "/data/$GFA" -b /data/depth_windows.bed \
  | awk -v p="${REF}#1#chr" -v OFS='\t' '$1 == p && $4 + 0 == $4 { print "chr", $2, $3, $4 }' \
  | sort -k1,1 -k2,2n > ecoli_pggb_depth.bedgraph
printf 'chr\t%s\n' "$REFLEN" > chrom.sizes
bedGraphToBigWig ecoli_pggb_depth.bedgraph chrom.sizes ecoli_pggb_depth.bw

# ── Projection 4b: per-strain presence/absence (odgi pav) as a MultiWiggle ─────
# odgi depth above sums every path into one core/accessory curve; odgi pav splits
# it per strain: for each REF window and each strain, the fraction of that window
# the strain's path traverses (1 = fully present, ->0 = accessory/absent in that
# strain). Slice each non-REF strain's rows into their own bigWig and load the set
# as one MultiQuantitativeTrack. pav's default TSV is chrom/start/end/name/group/
# pav, so filter on the group column (= the PanSN path). Reuses depth_windows.bed.
in_pggb odgi pav -i "/data/$GFA" -b /data/depth_windows.bed > pav.tsv
for strain in $STRAINS; do
  [ "$strain" = "$REF" ] && continue   # REF is present over its own windows by construction
  awk -F'\t' -v OFS='\t' -v g="${strain}#1#chr" \
    '$5 == g && $6 + 0 == $6 { print "chr", $2, $3, $6 }' pav.tsv \
    | sort -k1,1 -k2,2n > "ecoli_pggb_pav_${strain}.bedgraph"
  bedGraphToBigWig "ecoli_pggb_pav_${strain}.bedgraph" chrom.sizes "ecoli_pggb_pav_${strain}.bw"
done

# ── Graph overview: odgi viz (the "vs odgi viz" comparison figure) ────────────
# A static raster of the graph itself: one row per strain, x-axis = graph node
# order (the "pangenome sequence"), colored by path coverage. NOT a JBrowse track
# — the tutorial contrasts this graph-native axis against the four reference-
# anchored projections. Copy ecoli_pggb_graph.png into website/static/img/
# pangenome/graph.png to render that figure.
# -a 40 makes each of the (few) strain rows tall enough to read; the small -y
# keeps the link band below them slim so the path rows dominate the figure.
in_pggb odgi viz -i "/data/$GFA" -o /data/ecoli_pggb_graph.png -x 1500 -a 40 -y 260

# ── Set up JBrowse (installed `jbrowse`, else the CLI via npx) ────────────────
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

# projection 1: all-vs-all synteny. Written as add-track-json (not
# `add-track --adapterType`, which the released @jbrowse/cli rejects) so the
# script runs on any CLI version; drop the pif beside config.json for the uris.
cp ecoli_pggb_ava.pif.gz ecoli_pggb_ava.pif.gz.tbi "$APP/"
cat > ava_track.json <<JSON
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_pggb_ava",
  "name": "pggb graph: all-vs-all synteny (wfmash)",
  "assemblyNames": [$(echo "$STRAINS" | sed 's/ /", "/g; s/^/"/; s/$/"/')],
  "adapter": {
    "type": "AllVsAllIndexedPAFAdapter",
    "pifGzLocation": { "uri": "ecoli_pggb_ava.pif.gz" },
    "index": { "location": { "uri": "ecoli_pggb_ava.pif.gz.tbi" } },
    "assemblyNames": [$(echo "$STRAINS" | sed 's/ /", "/g; s/^/"/; s/$/"/')]
  }
}
JSON
jb add-track-json ava_track.json --update --out "$APP"

# projection 2: pangenome variants (matrix display by default)
jb add-track ecoli_pggb.vcf.gz --trackId ecoli_pggb_variants \
  --name "pggb graph: pangenome variants (vs K12)" -a K12 --load copy --force --out "$APP"

# projection 3: whole-genome MAF (BgzipTaffyAdapter carries the sample list).
# add-track-json takes a file/inline JSON (no --load copy), so drop the taf files
# beside config.json where the relative uris point.
cp ecoli_pggb.taf.gz ecoli_pggb.taf.gz.tai "$APP/"
cat > maf_track.json <<'JSON'
{
  "type": "MafTrack",
  "trackId": "ecoli_pggb_maf",
  "name": "pggb graph: whole-genome alignment (MAF, vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BgzipTaffyAdapter",
    "samples": ["K12", "Sakai", "CFT073", "NCTC86"],
    "tafGzLocation": { "uri": "ecoli_pggb.taf.gz" },
    "taiLocation": { "uri": "ecoli_pggb.taf.gz.tai" }
  }
}
JSON
jb add-track-json maf_track.json --update --out "$APP"

# projection 4: pangenome depth (autodetected as a QuantitativeTrack bigWig)
jb add-track ecoli_pggb_depth.bw --trackId ecoli_pggb_depth \
  --name "pggb graph: pangenome depth (paths over K12)" -a K12 --load copy --force --out "$APP"

# projection 4b: per-strain presence (one bigWig per strain -> MultiQuantitativeTrack).
# add-track-json doesn't copy files, so drop the per-strain bigWigs beside config.json.
cp ecoli_pggb_pav_Sakai.bw ecoli_pggb_pav_CFT073.bw ecoli_pggb_pav_NCTC86.bw "$APP/"
cat > pav_track.json <<'JSON'
{
  "type": "MultiQuantitativeTrack",
  "trackId": "ecoli_pggb_pav",
  "name": "pggb graph: per-strain presence (odgi pav, vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      { "type": "BigWigAdapter", "name": "Sakai",  "bigWigLocation": { "uri": "ecoli_pggb_pav_Sakai.bw" } },
      { "type": "BigWigAdapter", "name": "CFT073", "bigWigLocation": { "uri": "ecoli_pggb_pav_CFT073.bw" } },
      { "type": "BigWigAdapter", "name": "NCTC86", "bigWigLocation": { "uri": "ecoli_pggb_pav_NCTC86.bw" } }
    ]
  }
}
JSON
jb add-track-json pav_track.json --update --out "$APP"

# ── Default session: all four projections ─────────────────────────────────────
# view 1 stacks the four strains for the synteny projection; view 2 is the K12
# reference lane with the depth, variant, and MAF projections beneath the genes.
cat > session.json <<'JSON'
{
  "name": "E. coli pangenome graph",
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
        "tracks": [["ecoli_pggb_ava"], ["ecoli_pggb_ava"], ["ecoli_pggb_ava"]],
        "drawCurves": false,
        "minAlignmentLength": 10000
      }
    },
    {
      "type": "LinearGenomeView",
      "init": {
        "assembly": "K12",
        "loc": "chr:1,000,000-1,010,000",
        "tracks": ["K12_genes", "ecoli_pggb_depth", "ecoli_pggb_pav", "ecoli_pggb_variants", "ecoli_pggb_maf"]
      }
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json with the four assemblies, gene tracks, and the pggb-graph"
echo "projections (synteny, variants, MAF, depth, per-strain presence). Serve it, e.g.:"
echo "  npx serve $(pwd)/$APP"
echo "The graph overview raster is ecoli_pggb_graph.png (odgi viz)."
