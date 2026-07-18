#!/usr/bin/env bash
#
# Runnable version of the TLDR in website/docs/quickstart_web.md.
#
# The quickstart's TLDR uses placeholder filenames (genome.fa, file.bam,
# file.vcf) that the reader supplies. This script fills them in with the volvox
# sample data JBrowse ships, so the whole flow runs end to end: it downloads a
# FASTA, a BAM, a VCF, and a GFF3, runs the exact index + add-assembly +
# add-track + text-index chain from the doc, and leaves a servable jbrowse2/
# with an alignments track, a variant track, and a searchable gene track.
#
# Raw data is fetched into $OUTDIR, then copied into $OUTDIR/jbrowse2 by
# `--load copy --out jbrowse2` (the doc's alternative to running from inside the
# app dir). Every input is pinned to the volvox test-data directory, so
# re-running reproduces the same config.
#
# Requires: samtools, bgzip + tabix (htslib), curl, and node (the JBrowse CLI is
#           fetched via npx unless `jbrowse` is already on PATH).
# Usage:    bash scripts/build_quickstart_web.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-quickstart_web_build}"
APP=jbrowse2
BASE=https://jbrowse.org/code/jb2/latest/test_data/volvox

# ── Check prerequisites (mirrors the doc's Prerequisites section) ────────────
for tool in samtools bgzip tabix curl node; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH. See the Prerequisites section of" >&2
    echo "       website/docs/quickstart_web.md for install instructions." >&2
    exit 1
  }
done

# Use an installed `jbrowse`, else the CLI via npx.
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

dl() { [ -f "$2" ] || curl -fLsS "$1" -o "$2"; }

mkdir -p "$OUTDIR"
cd "$OUTDIR"

# ── Download JBrowse 2 into ./$APP ───────────────────────────────────────────
[ -f "$APP/index.html" ] || jb create "$APP"

# ── Genome assembly (FASTA): fetch, faidx, add ───────────────────────────────
dl "$BASE/volvox.fa" volvox.fa
samtools faidx volvox.fa
jb add-assembly volvox.fa --load copy --force --out "$APP"

# ── Alignments (BAM): fetch, index, add ──────────────────────────────────────
dl "$BASE/volvox-sorted.bam" volvox-sorted.bam
samtools index volvox-sorted.bam
jb add-track volvox-sorted.bam --load copy --force --out "$APP"

# ── Variants (VCF): fetch plain VCF, bgzip + tabix, add ──────────────────────
dl "$BASE/volvox.filtered.vcf" volvox.filtered.vcf
bgzip -f volvox.filtered.vcf
tabix -f volvox.filtered.vcf.gz
jb add-track volvox.filtered.vcf.gz --load copy --force --out "$APP"

# ── Genes (GFF3): sort, bgzip + tabix, add (gives text-index named features) ─
dl "$BASE/volvox.sort.gff3" volvox.sort.gff3
jb sort-gff volvox.sort.gff3 | bgzip > volvox.sorted.gff3.gz
tabix -f volvox.sorted.gff3.gz
jb add-track volvox.sorted.gff3.gz --load copy --force --out "$APP"

# ── Build the name search index (indexes the GFF3 + VCF tracks) ──────────────
jb text-index --force --out "$APP"

echo
echo "Built $(pwd)/$APP/config.json with the volvox assembly plus alignments,"
echo "variant, and gene tracks, and a search index over feature names."
echo "Serve it and open http://localhost:3000, e.g.:"
echo "  npx serve -S $(pwd)/$APP"
