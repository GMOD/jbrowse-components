#!/usr/bin/env bash
#
# Reproducibly build the Cancer Genome in a Bottle (C-GIAB / HG008) SV + CNV
# demo shown in website/docs/tutorials/sv_visualization_cgiab.md, then wire up a
# runnable JBrowse.
#
# It downloads the C-GIAB build of GRCh38, the V0.5 HG008-T benchmark SV (VCF)
# and CNV (BED) calls, converts the tumor/normal PacBio HiFi BAMs to CRAM,
# computes whole-genome coverage (megadepth), calls somatic copy number with
# HiFiCNV (depth/MAF/copy-number/VCF tracks), loads C-GIAB's published Wakhan
# haplotype-specific segments, and aligns the T2T tumor assembly (v3.2) to GRCh38
# with minimap2 for the synteny/dotplot views. All of these are added to a
# JBrowse config.
#
# Everything is pinned (fixed C-GIAB FTP paths, fixed V0.5 benchmark, fixed
# accessions), so re-running reproduces the same tracks. It is the same pipeline
# the tutorial documents step by step. It downloads >200 GB and the alignment and
# copy-number steps take hours.
#
# Requires: samtools + tabix (htslib >=1.20), minimap2, megadepth and HiFiCNV
#           (both fetched below if absent), wget/curl, and node (JBrowse CLI, via
#           npx unless `jbrowse` is on PATH).
# Disk:     ~1.5 TB free (the CRAMs are copied into the JBrowse dir; if
#           constrained, switch the CRAM add-track calls to `--load move` and
#           delete intermediates as you go).
# RAM:      ~32 GB for the minimap2 assembly-to-reference step.
# Usage:    bash scripts/build_sv_visualization_cgiab.sh [outdir]
#
# Remote / headless runs (the usual case, given the size):
#   - Linux x86_64 only if you rely on the auto-fetch below. megadepth and
#     HiFiCNV are pulled as linux_x86_64 release binaries; on any other arch
#     install both yourself and put them on PATH first.
#   - Outbound ftp:// must work. The tumor/normal reads are streamed from
#     ftp-trace.ncbi.nlm.nih.gov because the https mirror cannot range-seek a
#     BAM. Many cloud firewalls block passive FTP, which shows up as samtools
#     hanging on the first read. Test it in one line before committing hours:
#       samtools view -H "$PB/$NORMAL_BAM" | head -1
#     (with PB/NORMAL_BAM as built below) and expect an @HD line back.
#   - Run it detached (tmux/screen/nohup). The whole thing takes hours.
#   - Safe to re-run. Every step is guarded on its output file existing, so an
#     interrupted run resumes where it stopped instead of re-downloading.
#     Corollary: to force a step, delete its output.
#   - THREADS=N controls samtools/minimap2/HiFiCNV parallelism (default 8).
#
# Publishing after a build: the hosted demo only needs 5 small files, so you do
# not need rclone/AWS credentials on the remote box. Copy these back and run
# website/scripts/upload-cgiab-demo.sh locally:
#   hificnv.<sample>.depth.bw -> HG008-T.hificnv.depth.bw
#   hificnv.<sample>.maf.bw   -> HG008-T.hificnv.maf.bw
#   HG008T_<ver>.pif.gz(.tbi)  (from `jbrowse make-pif HG008T_<ver>.paf`)
#   jbrowse2/config.json
# Then regenerate the tutorial figures: cd website && pnpm gen-screenshots --filter sv_cgiab
#
set -euo pipefail

OUTDIR="${1:-cgiab_build}"
THREADS="${THREADS:-8}"

# ── Pinned dataset versions ──────────────────────────────────────────────────
# Everything version-specific lives here, so moving to a newer C-GIAB release
# is an edit to this block rather than a hunt through the script. Browse
# https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/
# for what is current, then bump these and delete the corresponding files from
# $OUTDIR so the guards below re-fetch them (the script skips any output that
# already exists, so a stale file will otherwise be kept).
BENCH_VER=V0.5                                                   # benchmark release
BENCH_DIR=NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.5-20260318
PB_RUN=PacBio_Revio_20240125                                     # HiFi tumor/normal run
NORMAL_DEPTH=35x
TUMOR_DEPTH=116x
GERMLINE_RUN=pacbio-wgs-wdl_germline_20240206                    # normal small-variant calls
WAKHAN_RUN=NIH_HiFi_Wakhan-CNA_20240308                          # published CNA segments
ASM_VER=v3.2                                                     # T2T tumor assembly
REF_BUILD=GRCh38_GIABv3                                          # C-GIAB reference build

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

FTP=https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab

# ── Human reference: the C-GIAB build of GRCh38 (decoys + masked regions) ─────
REF=$REF_BUILD.fa
if [ ! -f "$REF" ]; then
  curl -L "$FTP/release/references/GRCh38/${REF_BUILD}_no_alt_analysis_set_maskedGRC_decoys_MAP2K3_KMT2C_KCNJ18.fasta.gz" > "$REF.gz"
  gunzip "$REF.gz"
fi
[ -f "$REF.fai" ] || samtools faidx "$REF"
jb add-assembly "$REF" --name "$REF_BUILD" --load copy --force --out "$APP"

# NCBI RefSeq genes, kept as a remote URL track (no --load)
jb add-track https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz \
  --indexFile https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi \
  --force --out "$APP"

# ── V0.5 HG008-T benchmark SV (VCF, kept remote) and CNV (BED, header added) ──
BENCH=$FTP/data_somatic/HG008/Liss_lab/analysis/$BENCH_DIR
jb add-track "$BENCH/GRCh38_HG008-T-${BENCH_VER}_somatic-stvar_PASS.draftbenchmark.vcf.gz" \
  --category "Variant calls" --force --out "$APP"

CNV_BED=GRCh38_HG008-T-${BENCH_VER}_somatic-CNV_PASS.draftbenchmark.calls.bed
if [ ! -f "$CNV_BED" ]; then
  # the benchmark BED ships without a header; prepend one to name each column
  (printf '#chrom\tstart\tend\ttotal_copy_number\thap1_copy_number\thap2_copy_number\tname\n' \
    && curl -L "$BENCH/$CNV_BED") > "$CNV_BED"
fi
jb add-track "$CNV_BED" --category "Variant calls" --load copy --force --out "$APP"

# ── Tumor/normal PacBio HiFi: remote BAM -> local CRAM, + coverage bigWig ─────
# CRAM adds MD-tag-free SNP display and is far faster to serve than the remote
# BAM. This downloads >200 GB.
# samtools reads the remote BAMs over ftp:// (the https FTP mirror can't range-seek a BAM)
PB=ftp://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/$PB_RUN
PB_TAG=${PB_RUN//PacBio_Revio_/PacBio-HiFi-Revio_}
NORMAL=HG008-N-P_${PB_TAG}_${NORMAL_DEPTH}_GRCh38-GIABv3.cram
TUMOR=HG008-T_${PB_TAG}_${TUMOR_DEPTH}_GRCh38-GIABv3.cram
[ -f "$NORMAL" ] || samtools view -@"$THREADS" "$PB/${NORMAL%.cram}.bam" \
  --write-index -o "$NORMAL" -T "$REF"
[ -f "$TUMOR" ] || samtools view -@"$THREADS" "$PB/${TUMOR%.cram}.bam" \
  --write-index -o "$TUMOR" -T "$REF"

if [ ! -x ./megadepth ]; then
  wget -q https://github.com/ChristopherWilks/megadepth/releases/download/1.2.0/megadepth
  chmod +x megadepth
fi
for cram in "$NORMAL" "$TUMOR"; do
  [ -f "$cram.all.bw" ] || ./megadepth "$cram" --bigwig
  jb add-track "$cram" --category "Reads" --load copy --force --out "$APP"
  jb add-track "$cram.all.bw" --category "Coverage" --load copy --force --out "$APP"
done

# ── CNV: HiFiCNV somatic copy number (depth, MAF, copy-number, VCF tracks) ────
if command -v hificnv >/dev/null 2>&1; then
  HIFICNV=hificnv
else
  if [ ! -x ./hificnv ]; then
    curl -L https://github.com/PacificBiosciences/HiFiCNV/releases/latest/download/hificnv-linux_x86_64.tar.gz \
      | tar xz --strip-components=1 --wildcards '*/hificnv'
    chmod +x hificnv
  fi
  HIFICNV=./hificnv
fi

# germline small-variant calls for the normal drive the MAF track
GERMLINE_VCF=HG008-N-P.GRCh38.deepvariant.phased.vcf.gz
[ -f "$GERMLINE_VCF" ] || curl -L -O "$FTP/data_somatic/HG008/Liss_lab/analysis/$PB_RUN/$GERMLINE_RUN/$GERMLINE_VCF"

if ! ls hificnv.*.depth.bw >/dev/null 2>&1; then
  "$HIFICNV" --bam "$TUMOR" --ref "$REF" --maf "$GERMLINE_VCF" \
    --threads "$THREADS" --output-prefix hificnv
fi
for f in hificnv.*.depth.bw hificnv.*.maf.bw; do
  jb add-track "$f" --category "CNV" --load copy --force --out "$APP"
done
for v in hificnv.*.vcf.gz; do
  [ -f "$v.tbi" ] || tabix -p vcf "$v"
  jb add-track "$v" --category "CNV" --load copy --force --out "$APP"
done

# ── CNV: published Wakhan haplotype-specific copy-number/LOH segments ─────────
WAKHAN=$FTP/data_somatic/HG008/Liss_lab/analysis/$WAKHAN_RUN/bed_output
jb add-track "$WAKHAN/HG008_HiFi_copynumbers_segments.bed" --category "CNV" --force --out "$APP"
jb add-track "$WAKHAN/HG008_HiFi_loh_segments.bed" --category "CNV" --force --out "$APP"

# ── T2T tumor assembly (v3.2) -> GRCh38 (minimap2), for synteny/dotplot ───────
ASM_NAME=HG008T_$ASM_VER
ASM=$ASM_NAME.fasta
if [ ! -f "$ASM" ]; then
  curl -L "https://nist-giab.s3.us-east-1.amazonaws.com/giab_tumor-normal/analysis/HG008/NIST_asm_dev/$ASM_NAME/$ASM_NAME.fasta.gz" > "$ASM.gz"
  gunzip "$ASM.gz"
fi
[ -f "$ASM.fai" ] || samtools faidx "$ASM"
jb add-assembly "$ASM" --name "$ASM_NAME" --load copy --force --out "$APP"
# minimap2 target query: asm5 same-species, -c emits base-level CIGAR
[ -f "$ASM_NAME.paf" ] || minimap2 -t"$THREADS" -cx asm5 "$REF" "$ASM" > "$ASM_NAME.paf"
# add-track -a is query,target (reverse of minimap2's target query order)
jb add-track "$ASM_NAME.paf" -a "$ASM_NAME,$REF_BUILD" --load copy --force --out "$APP"

echo
echo "Built $APP/config.json with the C-GIAB GRCh38 assembly, RefSeq genes, the"
echo "V0.5 benchmark SV/CNV calls, tumor/normal CRAM + coverage, the HiFiCNV"
echo "copy-number tracks, the published Wakhan segments, and the T2T"
echo "tumor-assembly synteny track. Serve it and open in a browser, e.g.:"
echo "  npx --yes serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
