#!/usr/bin/env bash
#
# Gene density against Alu and L1 density along hg38, the dataset behind
# website/docs/tutorials/gene_density.md.
#
# Every input is a hosted file. The RefSeq curated genes and UCSC's RepeatMasker
# table are read from jbrowse.org's copies of the UCSC hg38 hub, the repeat
# table is cut into one BED per family (Alu, L1, and the simple repeats as the
# control), and `jbrowse make-density` counts each file's feature starts per
# 1 kb into a bigWig, added as a track of its own beside the file it counts, so
# a whole chromosome of genes or of Alus is one picture.
#
# Requires: bgzip + tabix (htslib), bedGraphToBigWig (UCSC), curl, awk, and
#           node (the JBrowse CLI is fetched via npx unless `jbrowse` is on
#           PATH, or JBROWSE_CLI names a command to run in its place).
# Usage:    bash scripts/build_gene_density.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-gene_density_build}"

for tool in bgzip tabix bedGraphToBigWig curl awk node; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

if [ -n "${JBROWSE_CLI:-}" ]; then
  # shellcheck disable=SC2086
  jb() { $JBROWSE_CLI "$@"; }
elif command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

mkdir -p "$OUTDIR"
cd "$OUTDIR"
APP=jbrowse2

HUB=https://jbrowse.org/ucsc/hg38
UCSC=https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips

# ── Inputs ──────────────────────────────────────────────────────────────────
# The chrom.sizes gives bedGraphToBigWig the reference lengths. The gene file
# is bgzipped GFF3 already; RepeatMasker is a bgzipped BED whose header names
# its columns, repFamily in the sixth and repClass in the seventh.
[ -f hg38.chrom.sizes ] || curl -fsSLo hg38.chrom.sizes "$UCSC/hg38.chrom.sizes"
[ -f genes.gff.gz ] || curl -fsSLo genes.gff.gz "$HUB/ncbiRefSeqCurated.gff.gz"
[ -f rmsk.bed.gz ] || curl -fsSLo rmsk.bed.gz "$HUB/rmsk.bed.gz"

# ── Genes ───────────────────────────────────────────────────────────────────
# The file is already sorted, so it only needs its own index. make-density
# counts a GFF3's top-level features, so a gene is one count however many
# transcripts and exons hang under it.
tabix -f -p gff genes.gff.gz
# the bigWig is named for the file without its .gz: genes.gff.density.bw
[ -f genes.gff.density.bw ] || jb make-density genes.gff.gz --chrom-sizes hg38.chrom.sizes

# ── One BED per repeat family ───────────────────────────────────────────────
# Cutting the table by family keeps each track honest: the Alu track's features
# are Alus and its bigWig counts Alus. The header line is kept so
# BedTabixAdapter still knows the column names, and the input's sort order
# survives a filter, so no re-sort is needed before tabix.
for family in Alu L1 Simple_repeat; do
  [ -f "$family.bed.gz" ] || gzip -dc rmsk.bed.gz |
    awk -F'\t' -v fam="$family" '/^#/ || $6 == fam' |
    bgzip >"$family.bed.gz"
  tabix -f -p bed "$family.bed.gz"
  [ -f "$family.bed.density.bw" ] || jb make-density "$family.bed.gz" --chrom-sizes hg38.chrom.sizes
done

# ── JBrowse ─────────────────────────────────────────────────────────────────
[ -f "$APP/index.html" ] || jb create "$APP"
jb add-assembly "$UCSC/hg38.2bit" --name hg38 --type twoBit --force --out "$APP"
cp -f genes.gff.gz genes.gff.gz.tbi genes.gff.density.bw "$APP"/
for family in Alu L1 Simple_repeat; do
  cp -f "$family.bed.gz" "$family.bed.gz.tbi" "$family.bed.density.bw" "$APP"/
done

jb add-track genes.gff.gz --trackId hg38_genes --name "RefSeq curated genes" \
  --assemblyNames hg38 --load inPlace --out "$APP" --force
# --displayDefaults draws each bin's mean alone: a 1 kb count is mostly 0 or 1,
# so the min-max band around it would read as a presence stripe zoomed out
jb add-track genes.gff.density.bw --trackId hg38_genes_density --name "RefSeq genes per kb" \
  --assemblyNames hg38 --displayDefaults '{"mark":{"extent":"none"}}' --load inPlace --out "$APP" --force
for family in Alu L1 Simple_repeat; do
  jb add-track "$family.bed.gz" --trackId "hg38_$family" --name "RepeatMasker $family" \
    --assemblyNames hg38 --load inPlace --out "$APP" --force
  jb add-track "$family.bed.density.bw" --trackId "hg38_${family}_density" \
    --name "${family/Simple_repeat/Simple repeats} per kb" --assemblyNames hg38 \
    --displayDefaults '{"mark":{"extent":"none"}}' --load inPlace --out "$APP" --force
done

echo "built $OUTDIR/$APP; serve it with: npx --yes serve $OUTDIR/$APP"
