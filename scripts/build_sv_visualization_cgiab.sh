#!/usr/bin/env bash
#
# Reproducibly build the Cancer Genome in a Bottle (C-GIAB / HG008) SV + CNV
# demo shown in website/docs/tutorials/sv_visualization_cgiab.md, then wire up a
# runnable JBrowse.
#
# It downloads the C-GIAB build of GRCh38, the V0.5 HG008-T benchmark SV (VCF)
# and CNV (BED) calls, converts the tumor/normal PacBio HiFi BAMs to CRAM,
# computes whole-genome coverage (megadepth), calls somatic copy number with
# HiFiCNV (depth/copy-number/VCF tracks), builds an unfolded B-allele-frequency
# bigWig over germline het sites, loads the CNV callsets C-GIAB publishes for this
# pair (Wakhan per-haplotype segments, NYGC BIC-seq2, DRAGEN), and aligns the T2T
# tumor assembly (v3.2) to GRCh38
# with minimap2 for the synteny/dotplot views. All of these are added to a
# JBrowse config.
#
# Everything is pinned (fixed C-GIAB FTP paths, fixed V0.5 benchmark, fixed
# accessions), so re-running reproduces the same tracks. It is the same pipeline
# the tutorial documents step by step. It downloads >200 GB and the alignment and
# copy-number steps take hours.
#
# Requires: samtools + tabix + bcftools (htslib >=1.20), minimap2, bedGraphToBigWig
#           (UCSC), megadepth and HiFiCNV
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
# Publishing after a build: the hosted demo needs only the files below (~1.4GB,
# nearly all of it the assembly), so you do not need rclone/AWS credentials on
# the remote box. Copy these back and run website/scripts/upload-cgiab-demo.sh:
#   hificnv.<bam-sample>.depth.bw -> HG008-T.hificnv.depth.bw
#     (HiFiCNV names each output for the sample it came from, so its maf.bw
#     carries the --maf VCF's sample column, not the --bam one. The figures use
#     the unfolded BAF bigWig below instead of that folded maf.bw.)
#   HG008-T_baf.bcftools.bw
#   HG008-T_bicseq2_log2ratio.bedgraph
#   HG008T_<ver>.pif.gz(.tbi)  (from `jbrowse make-pif HG008T_<ver>.paf`)
#   HG008T_<ver>.fasta.gz(.fai,.gzi)  (NIST ships it BGZF; just samtools faidx)
#   GRCh38_HG008-T-<BENCH_VER>_somatic-CNV_PASS.draftbenchmark.calls.bed
#   config.json  (demos/cgiab/config.json, which is kept byte-identical to what
#     jbrowse.org/demos/cgiab/ serves -- NOT jbrowse2/config.json, whose
#     --load copy paths are local and do not exist on S3)
# Deploy that config with scripts/deploy-demo.sh cgiab/config.json, which uploads
# and invalidates in one step and refuses to push anything that differs from the
# checked-in copy. The bucket has no versioning, so an overwrite assembled
# somewhere else is unrecoverable.
# Then regenerate the tutorial figures: cd website && pnpm screenshots --filter sv_cgiab
#
# A config-only change (e.g. the BAF track's resolutionMultiplier) needs no
# rebuild and no data upload: deploy demos/cgiab/config.json on its own.
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
WAKHAN_RUN=NIH_HiFi_Wakhan-CNA_20240308                          # HiFi run, source of the Clair3 tumor VCF
WAKHAN_CNA_RUN='NIH_HiFi-HiC_Wakhan-CNA_20240424'                # later run, phased with HiFi + Hi-C
NYGC_RUN='NYGC-somatic-pipeline_20240412'                        # published short-read somatic run
DRAGEN_RUN='DRAGEN-v4.2.4_ILMN-WGS_20240312'                     # published short-read CNV/SV calls
SEVERUS_RUN='NIH_HiFi_Severus-SV_20240308'                       # published HiFi somatic SVs
MINDA_RUN='NIH-NCI_minda-ensemble_20240710'                      # published ensemble SV callset
ASM_VER=v3.2                                                     # T2T tumor assembly
REF_BUILD=GRCh38_GIABv3                                          # C-GIAB reference build
HIFICNV_VER=1.0.1                                                # HiFiCNV release

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

# ── SV: the four other published somatic SV callsets on the same pair ─────────
# All remote URLs, nothing computed. Severus is HiFi, DRAGEN is short-read, minda
# is an ensemble over eleven caller runs across HiFi/ONT/Illumina, and NYGC's is
# a BEDPE whose evidence column carries Manta's and GRIDSS's own split-read and
# paired-end counts. add-track infers VcfTabixAdapter, VcfAdapter (the ensemble
# VCF is not indexed) and BedpeAdapter from the extensions.
ANALYSIS=$FTP/data_somatic/HG008/Liss_lab/analysis
jb add-track "$ANALYSIS/$SEVERUS_RUN/somatic_SVs/severus_somatic.vcf.gz" \
  --category "Variant calls" --force --out "$APP"
jb add-track "$ANALYSIS/$MINDA_RUN/HG008_minda_ensemble.vcf" \
  --category "Variant calls" --force --out "$APP"
jb add-track "$ANALYSIS/$DRAGEN_RUN/standard/dragen_4.2.4_HG008-mosaic_tumor.sv.vcf.gz" \
  --category "Variant calls" --force --out "$APP"
jb add-track "$ANALYSIS/$NYGC_RUN/GRCh38-GIABv3/HG008-T--HG008-N.sv.annotated.v7.somatic.high_confidence.final.bedpe" \
  --category "Variant calls" --force --out "$APP"

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
    # pinned like every other version here; `latest/download` also silently
    # changed asset name (curl exits 0 on the 404 page, so tar is what fails)
    curl -fL "https://github.com/PacificBiosciences/HiFiCNV/releases/download/v$HIFICNV_VER/hificnv-v$HIFICNV_VER-x86_64-unknown-linux-gnu.tar.gz" \
      | tar xz --strip-components=1 --wildcards '*/hificnv'
    chmod +x hificnv
  fi
  HIFICNV=./hificnv
fi

# TUMOR small-variant calls drive HiFiCNV's MAF track. HiFiCNV builds that track
# by reading AD straight out of the --maf VCF; it never consults --bam for it. So
# the normal's germline calls (what this used to pass) produce a MAF track with
# no somatic signal at all -- flat ~0.5 across chr3p, which the V0.5 benchmark
# calls CN=1 0|1, i.e. complete LOH. With the tumor's calls the same arm reads
# ~0 (a germline het inside an LOH arm is homozygous in the tumor: 1742 het ->
# 13 het over chr3:30-32Mb).
#
# Scope: this governs maf.bw ONLY. Re-running with the normal's VCF leaves
# copynum.bedgraph byte-identical, so the segmentation and the CNV VCF are not
# MAF-informed, and depth comes from the BAM. The figures plot the unfolded BAF
# track built below rather than maf.bw, so nothing downstream of here depends on
# this choice -- it is pinned so the emitted maf.bw is at least not misleading.
# Clair3 tumor calls from the Wakhan run pinned above; no .tbi is published.
MAF_VCF=merge_output_tumor.vcf.gz
[ -f "$MAF_VCF" ] || curl -fL -O "$FTP/data_somatic/HG008/Liss_lab/analysis/$WAKHAN_RUN/vcf_inputs/$MAF_VCF"
[ -f "$MAF_VCF.tbi" ] || tabix -p vcf "$MAF_VCF"

if ! ls hificnv.*.depth.bw >/dev/null 2>&1; then
  "$HIFICNV" --bam "$TUMOR" --ref "$REF" --maf "$MAF_VCF" \
    --threads "$THREADS" --output-prefix hificnv
fi
for f in hificnv.*.depth.bw hificnv.*.maf.bw; do
  jb add-track "$f" --category "CNV" --load copy --force --out "$APP"
done
for v in hificnv.*.vcf.gz; do
  [ -f "$v.tbi" ] || tabix -p vcf "$v"
  jb add-track "$v" --category "CNV" --load copy --force --out "$APP"
done

# ── CNV: NYGC's BIC-seq2 segmented log2 copy ratio ────────────────────────────
# The lane the copy-number figures read, and the cheapest step in this script: a
# 20 KB download and one awk. Depth is a read count per bin, so a whole-
# chromosome view of it is a cloud and a copy-number step is wherever the cloud's
# centre moved; this is the same event already segmented, by the New York Genome
# Center's somatic pipeline run on this exact tumour/normal pair and published by
# C-GIAB. The normalization and the segmentation are theirs, which is the whole
# reason to take it rather than fit our own baseline to the depth track.
#
# Read as published, not re-centred: BIC-seq2 normalizes on total read counts and
# HG008-T is hypodiploid, so its balanced state sits above 0. The steps are what
# the figures read, and each lands where the V0.5 benchmark says it should.
BICSEQ_BG=HG008-T_bicseq2_log2ratio.bedgraph
if [ ! -f "$BICSEQ_BG" ]; then
  NYGC=$FTP/data_somatic/HG008/Liss_lab/analysis/$NYGC_RUN/GRCh38-GIABv3
  [ -f HG008-T--HG008-N.bicseq2.txt ] || curl -fL -O "$NYGC/HG008-T--HG008-N.bicseq2.txt"
  # col 9 is log2.copyRatio; the file is 1-based and bedGraph is not
  awk 'NR>1 {printf "%s\t%d\t%d\t%.4f\n", $1, $2-1, $3, $9}' \
    HG008-T--HG008-N.bicseq2.txt > "$BICSEQ_BG"
fi
jb add-track "$BICSEQ_BG" --category "CNV" --load copy --force --out "$APP"

# ── B-allele frequency: unfolded, over germline het sites ────────────────────
# The allelic panel of the depth/BAF figure. NOT HiFiCNV's own maf.bw: that one
# is folded to min(AF, 1-AF), so an arm that lost a parental copy collapses onto
# a single band near 0 and the reader loses the mirrored 0/1 split that makes a
# BAF plot legible at a glance. Unfolded BAF keeps both bands, so a balanced arm
# reads as one band at 0.5 and an LOH arm as two at 0 and 1.
#
# Definition: pile the TUMOR reads up at sites the NORMAL calls heterozygous,
# and take alt/(ref+alt) unfolded. The germline het list is what makes a site
# informative; computing it from the tumor's own calls instead would drop the
# LOH sites (homozygous in the tumor) and erase the very signal being drawn.
BAF_BW=HG008-T_baf.bcftools.bw
if [ ! -f "$BAF_BW" ]; then
  GERMLINE_VCF=HG008-N-P.GRCh38.deepvariant.phased.vcf.gz
  [ -f "$GERMLINE_VCF" ] || curl -fL -O "$FTP/data_somatic/HG008/Liss_lab/analysis/$PB_RUN/pacbio-wgs-wdl_germline_20240206/$GERMLINE_VCF"
  [ -f hets.vcf.gz ] || { bcftools view -g het -Oz -o hets.vcf.gz "$GERMLINE_VCF"; tabix -f -p vcf hets.vcf.gz; }
  [ -f "$REF.chrom.sizes" ] || cut -f1,2 "$REF.fai" > "$REF.chrom.sizes"
  # -q 1 drops multi-mapped reads; -Q 0 keeps HiFi base qualities as-is. The
  # >=10x floor keeps a thin-coverage site from painting a spurious 0 or 1.
  bcftools mpileup -f "$REF" -T hets.vcf.gz -a AD -q 1 -Q 0 "$TUMOR" 2>/dev/null \
    | bcftools query -f '%CHROM\t%POS\t[%AD]\n' \
    | awk -F'[\t,]' '{d=$3+$4; if(d>=10) printf "%s\t%d\t%d\t%.4f\n",$1,$2-1,$2,$4/d}' \
    | LC_COLLATE=C sort -k1,1 -k2,2n > baf.bedgraph
  bedGraphToBigWig baf.bedgraph "$REF.chrom.sizes" "$BAF_BW"
fi
# add-track-json rather than add-track, because the settings that make this
# track legible are not things add-track can express. A bigWig zoom level carries
# only min/avg/max per bin: a fair summary of read depth, a meaningless one for
# BAF, whose per-bin values are a distribution. Every summary bin over an LOH arm
# comes back min 0 / max 1 / avg noise, and the default whiskers rendering paints
# all three as one solid full-height wash. resolutionMultiplier scales the
# bases-per-bin the adapter asks for; the finest zoom level in this file reduces
# at 2560 bp and bbi takes a zoom level when reductionLevel <= 2*basesPerSpan, so
# 0.001 keeps the fetch on raw per-site values out to ~1.28 Mbp/px. That covers
# every single-chromosome view (whole chr1 is ~190 kbp/px, 1.4 MB of raw points);
# whole-genome view still summarizes, which is what the Wakhan track below is for.
cp -f "$BAF_BW" "$APP/$BAF_BW"
cat > baf_track.json <<JSON
{
  "type": "QuantitativeTrack",
  "trackId": "HG008-T_baf",
  "name": "HG008-T B-allele frequency (BAF)",
  "category": ["CNV"],
  "assemblyNames": ["$REF_BUILD"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "$BAF_BW",
    "resolutionMultiplier": 0.001
  },
  "displayDefaults": {
    "defaultRendering": "scatter",
    "scatterPointSize": 1,
    "minScore": 0,
    "maxScore": 1
  }
}
JSON
jb add-track-json baf_track.json --update --out "$APP"

# ── CNV: published Wakhan haplotype-specific copy-number/LOH segments ─────────
# The later of the two published Wakhan runs, whose germline phasing uses Arima
# Hi-C alongside the HiFi reads. copynumbers_segments.bed is long format, one row
# per haplotype (chr/start/end/copynumber_state/coverage/haplotype), and unlike
# the March HiFi-only run its column-name line carries no leading '#', so
# BedAdapter cannot name the columns from the header and columnNames does it here.
# Partitioning on haplotype paints one row per parental copy: the same allelic
# state the BAF track carries but as segments, so it reads identically at every
# zoom. copynumber_state is one parental copy rather than the total, so 1 is the
# expected state and a 0 row is the lost haplotype that makes an arm LOH. Three
# color buckets, not four: the published file tops out at 2 per haplotype and also
# carries fractional (subclonal) states, so bucket rather than match.
WAKHAN=$FTP/data_somatic/HG008/Liss_lab/analysis/$WAKHAN_CNA_RUN/bed_output
cat > wakhan_track.json <<JSON
{
  "type": "FeatureTrack",
  "trackId": "hg008_wakhan_haplotype",
  "name": "HG008-T Wakhan copy number per haplotype",
  "category": ["CNV"],
  "assemblyNames": ["$REF_BUILD"],
  "adapter": {
    "type": "BedAdapter",
    "uri": "$WAKHAN/HG008_HiFi_HiC_copynumbers_segments.bed",
    "columnNames": ["chrom", "start", "end", "copynumber_state", "coverage", "haplotype"]
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "hg008_wakhan_haplotype-LinearMultiRowFeatureDisplay",
      "partitionField": "haplotype",
      "color": "jexl:get(feature,'copynumber_state')<0.5?'#2166ac':get(feature,'copynumber_state')<1.5?'#bdbdbd':'#f4a582'",
      "legend": [
        { "label": "Haplotype lost (0)", "color": "#2166ac" },
        { "label": "One copy", "color": "#bdbdbd" },
        { "label": "Two or more copies", "color": "#f4a582" }
      ]
    }
  ]
}
JSON
jb add-track-json wakhan_track.json --update --out "$APP"
jb add-track "$WAKHAN/HG008_HiFi_HiC_loh_segments.bed" --category "CNV" --force --out "$APP"

# ── CNV: the two published short-read callsets on the same pair ───────────────
# Both load from their FTP URLs with nothing downloaded and nothing computed, so
# the four callsets in this config (benchmark, Wakhan, NYGC, DRAGEN) can be read
# against each other in one view. DRAGEN's record IDs name the class it assigned
# (LOSS/GAIN/CNLOH/REF) and its FORMAT carries CN, the minor-haplotype copy
# number MCN, and the MAF behind both.
jb add-track "$ANALYSIS/$DRAGEN_RUN/standard/dragen_4.2.4_HG008-mosaic_tumor.cnv.vcf.gz" \
  --category "CNV" --force --out "$APP"

# NYGC's annotated form of the same BIC-seq2 segmentation the bedGraph above
# carries. Its #-header is tab-separated, so BedAdapter names the columns and
# each segment arrives with its call, log2 ratio, focal flag, cytoband and the
# Cancer Gene Census genes it covers. Color on the call, which is the `type`
# column: a BED feature has no type of its own, so the column reaches
# feature.type unopposed.
cat > nygc_cnv_track.json <<JSON
{
  "type": "FeatureTrack",
  "trackId": "hg008t_nygc_cnv",
  "name": "HG008-T NYGC CNV calls, annotated (BIC-seq2)",
  "category": ["CNV"],
  "assemblyNames": ["$REF_BUILD"],
  "adapter": {
    "type": "BedAdapter",
    "uri": "$ANALYSIS/$NYGC_RUN/GRCh38-GIABv3/HG008-T--HG008-N.cnv.annotated.v7.final.bed"
  },
  "displayDefaults": {
    "color": "jexl:feature.type=='DEL'?'#2166ac':'#b2182b'",
    "labels": { "name": "jexl:feature.type+' '+feature.cytoband" },
    "displayMode": "compact",
    "legend": [
      { "label": "Loss (DEL)", "color": "#2166ac" },
      { "label": "Gain (DUP)", "color": "#b2182b" }
    ]
  }
}
JSON
jb add-track-json nygc_cnv_track.json --update --out "$APP"

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
echo "depth track, the published Wakhan, NYGC and DRAGEN CNV callsets, and the"
echo "T2T tumor-assembly synteny track. Serve it and open in a browser, e.g.:"
echo "  npx --yes serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
