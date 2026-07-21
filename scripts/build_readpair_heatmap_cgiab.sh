#!/usr/bin/env bash
#
# Reproducibly build the read-pair contact heatmaps shown in
# website/docs/tutorials/readpair_heatmap.md, then wire up a runnable JBrowse.
#
# The idea (after PopicLab's Cue): an ordinary paired-end WGS alignment already
# encodes structural variants as read pairs whose two ends land far apart or in
# the wrong orientation. Binning every read pair into a .hic contact matrix turns
# that into a Hi-C-style heatmap where SVs read as off-diagonal signal. Here we
# do it over two regions of the HG008-T (C-GIAB) pancreatic-cancer tumor Illumina
# WGS: a chr3q window holding a 1.4 Mb tandem duplication + a four-breakpoint fold
# cluster, and the chr3<->chr13 translocation.
#
# Everything is pinned (fixed C-GIAB FTP path, fixed benchmark regions), so
# re-running reproduces the same .hic files. Only the two small regions are
# sliced from the remote 161x BAM, so it downloads <1 GB, not the whole genome.
#
# Requires: samtools (htslib >=1.20), java (for juicer_tools, fetched below if
#           absent), curl, awk, sort, and node (JBrowse CLI, via npx unless
#           `jbrowse` is on PATH). bam2contacts.sh sits beside this script.
# Usage:    bash scripts/build_readpair_heatmap_cgiab.sh [outdir]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTDIR="${1:-readpair_heatmap_build}"
THREADS="${THREADS:-4}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# ── JBrowse CLI (installed `jbrowse`, else npx) + a local app dir ─────────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi
APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP"

# ── juicer_tools (writes the .hic) ────────────────────────────────────────────
JUICER=juicer_tools.jar
[ -f "$JUICER" ] || curl -L \
  https://s3.amazonaws.com/hicfiles.tc4ga.com/public/juicer/juicer_tools_1.22.01.jar \
  -o "$JUICER"

FTP=https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab
BAM="$FTP/data_somatic/HG008/Liss_lab/NYGC_Illumina-WGS_20231023/HG008-T_Illumina_161x_GRCh38-GIABv3.bam"

# ── Assembly: the hosted C-GIAB build of GRCh38 (kept remote, no download) ────
jb add-assembly \
  https://jbrowse.org/demos/cgiab/GRCh38_GIABv3.fa.gz \
  --name GRCh38_GIABv3 --type bgzipFasta --force --out "$APP"

# chromosome sizes from the BAM header (fetches only the header, not the reads);
# .hic chromosome order must match this file's order, so reuse it everywhere.
[ -f chrom.sizes ] || samtools view -H "$BAM" \
  | awk -F'\t' '/^@SQ/{n="";l=""; for(i=1;i<=NF;i++){if($i~/^SN:/)n=substr($i,4); if($i~/^LN:/)l=substr($i,4)} print n"\t"l}' \
  > chrom.sizes

# ── One heatmap per event. slice remote region -> contacts -> .hic ────────────
# We keep only DISCORDANT pairs (large insert / wrong orientation / inter-
# chromosomal): dropping the concordant insert-size diagonal isolates the SV
# signal, the way Cue emphasises its discordant-pair channels. Swap `discordant`
# for `all` below to include the diagonal for Hi-C-style context.
# name | regions (space-separated, samtools multi-region) | juicer resolutions
build_hic() {
  local name="$1" regions="$2" res="$3"
  local bam="$name.bam" hic="HG008-T_readpair_$name.hic"
  # shellcheck disable=SC2086
  [ -f "$bam" ] || samtools view -@"$THREADS" -b "$BAM" $regions -o "$bam"
  [ -f "$bam.bai" ] || samtools index "$bam"
  MAX_NORMAL_TLEN=2000 bash "$SCRIPT_DIR/bam2contacts.sh" "$bam" discordant chrom.sizes \
    > "$name.contacts.txt"
  java -Xmx6g -jar "$JUICER" pre -r "$res" "$name.contacts.txt" "$hic" chrom.sizes
  jb add-track "$hic" --name "HG008-T read-pair contacts ($name)" \
    --category "Read-pair heatmaps" --load copy --force --out "$APP"
}

# chr3q: 1.4 Mb tandem dup (SV_22) + the 184.7 Mb fold cluster (SV_23/25/175/176)
build_hic chr3q "chr3:182,000,000-185,000,000" 1000,2500,5000,10000,25000

# chr3<->chr13 translocation (SV_20): slice a window on each side so the
# inter-chromosomal read pairs are counted from both ends
build_hic chr3-chr13_translocation \
  "chr3:139,900,000-140,050,000 chr13:114,300,000-114,400,000" 1000,2500,5000

echo
echo "Done. Serve the demo with:"
echo "  npx --yes serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
echo "Then open a Hi-C track, and for these raw read-pair maps set the display's"
echo "normalization to NONE with log-scale color so the off-diagonal SV signal reads."
