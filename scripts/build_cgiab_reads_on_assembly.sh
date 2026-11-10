#!/usr/bin/env bash
#
# Realign the HG008-T HiFi reads behind the chr3/chr13 junction figures to the
# HG008T v3.2 tumor assembly, so a read that splits on GRCh38 can be shown
# spanning the junction unbroken on chr3_chr13_hap1.
#
# The input is the hosted GRCh38 slice (scripts/build_demo_slices.sh), so depth
# on the assembly is exact only where a GRCh38 slice window lands.
#
# Requires: samtools, minimap2 (2.19+, for map-hifi), curl. RAM: ~32 GB.
# Usage:    THREADS=16 bash scripts/build_cgiab_reads_on_assembly.sh [outdir]
# Deploy:   upload the BAM and its .csi beside demos/cgiab/config.json
set -euo pipefail

for tool in samtools minimap2 curl awk sort; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

OUTDIR="${1:-cgiab_reads_on_assembly}"
THREADS="${THREADS:-8}"
DEMO=https://jbrowse.org/demos/cgiab
SLICE=HG008-T_PacBio-HiFi-Revio_116x.demo_slices.bam
ASM=HG008T_v3.2.fasta.gz
OUT=HG008-T_PacBio-HiFi-Revio_116x.HG008T_v3.2.demo_slices.bam
REGIONS=(chr3:139930000-140010000 chr13:114310000-114365000)

mkdir -p "$OUTDIR"
cd "$OUTDIR"

for f in "$SLICE" "$SLICE.bai" "$ASM"; do
  [ -f "$f" ] || { curl -fL -o "$f.part" "$DEMO/$f" && mv "$f.part" "$f"; }
done

# Primary records only: they carry the whole read, soft-clipped
samtools view -u -F 0x900 "$SLICE" "${REGIONS[@]}" |
  samtools fastq -T MM,ML - |
  minimap2 -t "$THREADS" -ax map-hifi --secondary=no -y "$ASM" - |
  samtools sort -@ 4 -o "$OUT" -
samtools index -c "$OUT"

samtools idxstats "$OUT" | awk '$3>0 {print $1, $3}' | sort -k2,2nr | awk 'NR<=10'
