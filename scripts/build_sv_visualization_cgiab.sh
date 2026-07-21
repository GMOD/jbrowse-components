#!/usr/bin/env bash
#
# Reproducibly build the Cancer Genome in a Bottle (C-GIAB / HG008) SV + CNV
# demo shown in website/docs/tutorials/sv_visualization_cgiab.md, then wire up a
# runnable JBrowse.
#
# It downloads the C-GIAB build of GRCh38, the V0.4 HG008-T benchmark SV (VCF)
# and CNV (BED) calls, converts the tumor/normal PacBio HiFi BAMs to CRAM,
# computes whole-genome coverage (megadepth), derives a log2(tumor/normal)
# coverage-ratio track (mosdepth) and a per-SNP B-allele-frequency track
# (bcftools mpileup over the germline hets), a per-base coverage slice over
# CDKN2A, and aligns both haplotypes of the phased verkko tumor assembly to
# GRCh38 with minimap2 for the synteny/dotplot views. All of these are added to
# a JBrowse config.
#
# Everything is pinned (fixed C-GIAB FTP paths, fixed V0.4 benchmark, fixed
# accessions), so re-running reproduces the same tracks. It is the same pipeline
# the tutorial documents step by step. It downloads >200 GB and the
# alignment/pileup steps take hours.
#
# Requires: samtools + bcftools + tabix (htslib >=1.20), mosdepth, minimap2,
#           the UCSC bedGraphToBigWig tool, megadepth (fetched below if absent),
#           wget/curl, python3, and node (JBrowse CLI, via npx unless `jbrowse`
#           is on PATH).
# Disk:     ~1.5 TB free (the CRAMs are copied into the JBrowse dir; if
#           constrained, switch the CRAM add-track calls to `--load move` and
#           delete intermediates as you go).
# RAM:      ~32 GB for the minimap2 assembly-to-reference step.
# Usage:    bash scripts/build_sv_visualization_cgiab.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-cgiab_build}"
THREADS="${THREADS:-8}"
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
REF=GRCh38_GIABv3.fa
if [ ! -f "$REF" ]; then
  curl -L "$FTP/release/references/GRCh38/GRCh38_GIABv3_no_alt_analysis_set_maskedGRC_decoys_MAP2K3_KMT2C_KCNJ18.fasta.gz" > "$REF.gz"
  gunzip "$REF.gz"
fi
[ -f "$REF.fai" ] || samtools faidx "$REF"
jb add-assembly "$REF" --name GRCh38_GIABv3 --load copy --force --out "$APP"

# NCBI RefSeq genes, kept as a remote URL track (no --load)
jb add-track https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz \
  --indexFile https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi \
  --force --out "$APP"

# ── V0.4 HG008-T benchmark SV (VCF, kept remote) and CNV (BED, header added) ──
BENCH=$FTP/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.4-20250714
jb add-track "$BENCH/GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf.gz" \
  --category "Variant calls" --force --out "$APP"

CNV_BED=GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls.bed
if [ ! -f "$CNV_BED" ]; then
  # the benchmark BED ships without a header; prepend one to name each column
  (printf '#chr\tstart\tend\ttotal_copy_number\thap1_copy_number\thap2_copy_number\tname\n' \
    && curl -L "$BENCH/GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls.bed") > "$CNV_BED"
fi
jb add-track "$CNV_BED" --category "Variant calls" --load copy --force --out "$APP"

# ── Tumor/normal PacBio HiFi: remote BAM -> local CRAM, + coverage bigWig ─────
# CRAM adds MD-tag-free SNP display and is far faster to serve than the remote
# BAM. This downloads >200 GB.
# samtools reads the remote BAMs over ftp:// (the https FTP mirror can't range-seek a BAM)
PB=ftp://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125
NORMAL=HG008-N-P_PacBio-HiFi-Revio_20240125_35x_GRCh38-GIABv3.cram
TUMOR=HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.cram
[ -f "$NORMAL" ] || samtools view -@"$THREADS" "$PB/HG008-N-P_PacBio-HiFi-Revio_20240125_35x_GRCh38-GIABv3.bam" \
  --write-index -o "$NORMAL" -T "$REF"
[ -f "$TUMOR" ] || samtools view -@"$THREADS" "$PB/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam" \
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

# ── CNV track 1: log2(tumor/normal) coverage ratio ───────────────────────────
# a 2-column chrom.sizes for the UCSC bedGraphToBigWig tool
SIZES=GRCh38_GIABv3.chrom.sizes
[ -f "$SIZES" ] || cut -f1,2 "$REF.fai" > "$SIZES"

# fixed 500bp windows, no per-base output (-n); -f gives the reference for CRAM
[ -f HG008-N.regions.bed.gz ] || mosdepth -t"$THREADS" -n -b 500 -f "$REF" HG008-N "$NORMAL"
[ -f HG008-T.regions.bed.gz ] || mosdepth -t"$THREADS" -n -b 500 -f "$REF" HG008-T "$TUMOR"

if [ ! -f HG008_log2ratio.bedgraph ]; then
  python3 - <<'PY'
import gzip, math, statistics
def load(p):
    d = {}
    with gzip.open(p, 'rt') as fh:
        for line in fh:
            c, s, e, v = line.split()
            d[(c, int(s), int(e))] = float(v)
    return d
n = load('HG008-N.regions.bed.gz')
t = load('HG008-T.regions.bed.gz')
autosomes = {f'chr{i}' for i in range(1, 23)}
def median(d):
    return statistics.median(v for k, v in d.items() if k[0] in autosomes and v > 0)
mn, mt = median(n), median(t)   # per-sample autosomal median
with open('HG008_log2ratio.bedgraph', 'w') as out:
    for k in sorted(k for k in n if k in t):
        nv, tv = n[k] / mn, t[k] / mt
        if nv > 0 and tv > 0:
            out.write(f'{k[0]}\t{k[1]}\t{k[2]}\t{math.log2(tv / nv):.4f}\n')
PY
fi
if [ ! -f HG008_log2ratio.bw ]; then
  # LC_COLLATE=C so decoy/HLA contigs sort the way bigWig expects
  LC_COLLATE=C sort -k1,1 -k2,2n HG008_log2ratio.bedgraph > HG008_log2ratio.sorted.bedgraph
  bedGraphToBigWig HG008_log2ratio.sorted.bedgraph "$SIZES" HG008_log2ratio.bw
fi
jb add-track HG008_log2ratio.bw --category "CNV" --load copy --force --out "$APP"

# ── CNV track 2: per-SNP B-allele frequency (BAF) ────────────────────────────
# germline small-variant calls for the normal sample (C-GIAB PacBio workflow)
GERMLINE_VCF=HG008-N-P.GRCh38.deepvariant.phased.vcf.gz
if [ ! -f "$GERMLINE_VCF" ]; then
  curl -L -O "$FTP/data_somatic/HG008/Liss_lab/analysis/PacBio_Revio_20240125/pacbio-wgs-wdl_germline_20240206/HG008-N-P.GRCh38.deepvariant.phased.vcf.gz"
  bcftools index -t "$GERMLINE_VCF"
fi
if [ ! -f hets.vcf.gz ]; then
  # heterozygous SNP sites (GT 0/1), PASS only
  bcftools view -g het -v snps -f PASS "$GERMLINE_VCF" -Oz -o hets.vcf.gz
  bcftools index -t hets.vcf.gz
fi

if [ ! -f HG008-T_baf.bedgraph ]; then
  # mpileup is single-threaded per site and dominates runtime, so split by
  # chromosome and run one process each, then concatenate (doc: ~11 min vs >1 h)
  export REF TUMOR
  mpileup_chrom() {
    bcftools mpileup -f "$REF" -r "$1" -T hets.vcf.gz -a AD -q 1 -Q 0 "$TUMOR" \
      | bcftools query -f '%CHROM\t%POS\t[%AD]\n' \
      | awk -F'[\t,]' '{d=$3+$4; if(d>=10) printf "%s\t%d\t%d\t%.4f\n",$1,$2-1,$2,$4/d}' \
      > "baf_part.$1.bedgraph"
  }
  export -f mpileup_chrom
  printf 'chr%s\n' {1..22} chrX chrY | xargs -P"$(nproc)" -I{} bash -c 'mpileup_chrom "$@"' _ {}
  baf_parts=()
  for c in {1..22} chrX chrY; do baf_parts+=("baf_part.chr$c.bedgraph"); done
  cat "${baf_parts[@]}" > HG008-T_baf.bedgraph
fi
if [ ! -f HG008-T_baf.bw ]; then
  # sort, then drop duplicate positions (multiallelic sites emit a position
  # twice, which bedGraphToBigWig rejects as overlapping)
  LC_COLLATE=C sort -k1,1 -k2,2n HG008-T_baf.bedgraph \
    | awk '!seen[$1"\t"$2]++' > HG008-T_baf.sorted.bedgraph
  bedGraphToBigWig HG008-T_baf.sorted.bedgraph "$SIZES" HG008-T_baf.bw
fi
jb add-track HG008-T_baf.bw --category "CNV" --load copy --force --out "$APP"

# ── CNV track 3: per-base coverage over CDKN2A (resolves the CN0 deletion) ────
if [ ! -f HG008-T_coverage_perbase.bw ]; then
  samtools view -b -T "$REF" "$TUMOR" chr9:21,800,000-22,200,000 -o cdkn2a_slice.bam
  samtools index cdkn2a_slice.bam
  mosdepth -t4 cdkn2a_perbase cdkn2a_slice.bam   # per-base mode (no -b/-n)
  zcat cdkn2a_perbase.per-base.bed.gz > HG008-T_coverage_perbase.bedgraph
  bedGraphToBigWig HG008-T_coverage_perbase.bedgraph "$SIZES" HG008-T_coverage_perbase.bw
fi
jb add-track HG008-T_coverage_perbase.bw --category "CNV" --load copy --force --out "$APP"

# ── Phased verkko tumor assembly -> GRCh38 (minimap2), for synteny/dotplot ────
VERKKO=$FTP/data_somatic/HG008/Liss_lab/analysis/Verkko_assemblies_05162024/HG008T/HG008T_verkko_v2.2.1_herro_corrected/PBhifi+20kbBCMhifi_UL_ONTq26_herro
for hap in 1 2; do
  fa=HG008T.hap$hap.fa
  [ -f "$fa" ] || curl -L "$VERKKO/assembly.haplotype$hap.fasta" > "$fa"
  [ -f "$fa.fai" ] || samtools faidx "$fa"
  jb add-assembly "$fa" --load copy --force --out "$APP"
  # minimap2 target query: asm5 same-species, -c emits base-level CIGAR
  [ -f "HG008T.hap$hap.paf" ] || minimap2 -t"$THREADS" -cx asm5 "$REF" "$fa" > "HG008T.hap$hap.paf"
  # add-track -a is query,target (reverse of minimap2's target query order)
  jb add-track "HG008T.hap$hap.paf" -a "HG008T.hap$hap,GRCh38_GIABv3" \
    --load copy --force --out "$APP"
done

echo
echo "Built $APP/config.json with the C-GIAB GRCh38 assembly, RefSeq genes, the"
echo "V0.4 benchmark SV/CNV calls, tumor/normal CRAM + coverage, the log2-ratio"
echo "and BAF CNV tracks, the CDKN2A per-base coverage, and the two-haplotype"
echo "tumor-assembly synteny tracks. Serve it and open in a browser, e.g.:"
echo "  npx --yes serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
