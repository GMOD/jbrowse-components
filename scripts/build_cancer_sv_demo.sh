#!/bin/bash
#
# Builds the data behind website/docs/tutorials/cancer_sv.md (complex somatic
# rearrangements and gene fusions), everything pinned:
#
#   COLO829 / COLO829BL  ONT R10 somatic SV calls and coverage from the ONT
#                        open-data release, plus the RARB/BICC1/TRHDE derivative
#                        allele that scripts/sv_multihop.py reconstructs from the
#                        tumour reads
#   K562                 ENCODE PacBio Iso-Seq alignments, DepMap 24Q4
#                        STAR-Fusion calls and copy-number segments, and the
#                        10X linked-read DNA breakpoints lifted from hg19
#
# The tumour CRAM and the normal BAM are streamed from the ONT bucket rather than
# downloaded; only the reconstruction outputs are written locally.
#
# Requires: samtools, minimap2, bedGraphToBigWig, bgzip, tabix, curl, python3, node>=18
#           The UCSC liftOver binary is downloaded into the output directory;
#           nothing is installed.
# Usage:    bash scripts/build_cancer_sv_demo.sh [outdir]
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)

# fetched on demand so a bare `curl -O` of this one script still works
HELPERS=(sv_multihop.py depmap_to_jbrowse.py lift_bnd_vcf.py)
for h in "${HELPERS[@]}"; do
  [ -f "$HERE/$h" ] || curl -fsSL -o "$HERE/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUTDIR="${1:-cancer_sv_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

APP=jbrowse2
DEMO=demo
mkdir -p "$DEMO"

jb() {
  if command -v jbrowse >/dev/null 2>&1; then jbrowse "$@"; else npx -y @jbrowse/cli "$@"; fi
}

ONT=https://ont-open-data.s3.amazonaws.com/colo829_2024.03
WF="$ONT/wf_somatic_variation/sup"
TUMOUR_CRAM="$WF/COLO829_tumor.ht.cram"
NORMAL_BAM="$ONT/basecalls/colo829bl/sup/PAU59807.d052sup4305mCG_5hmCGvHg38.bam"

# ---------------------------------------------------------------- reference
# The same GRCh38 build the ONT alignments used; samtools needs it to decode the
# CRAM, and sv_multihop.py aligns against it.
[ -f GRCh38.fa ] || curl -fL "$WF/GCA_000001405.15_GRCh38_no_alt_analysis_set.fasta" -o GRCh38.fa
[ -f GRCh38.fa.fai ] || curl -fL "$WF/GCA_000001405.15_GRCh38_no_alt_analysis_set.fasta.fai" -o GRCh38.fa.fai
cut -f1,2 GRCh38.fa.fai > hg38.chrom.sizes

# ------------------------------------------------------- COLO829 SV calls
[ -f "$DEMO/COLO829.somatic-sv.vcf.gz" ] ||
  curl -fL "$WF/COLO829.wf-somatic-sv.vcf.gz" -o "$DEMO/COLO829.somatic-sv.vcf.gz"
[ -f "$DEMO/COLO829.somatic-sv.vcf.gz.tbi" ] ||
  curl -fL "$WF/COLO829.wf-somatic-sv.vcf.gz.tbi" -o "$DEMO/COLO829.somatic-sv.vcf.gz.tbi"

# mosdepth's 50 kb windows, which is all the copy-number resolution the figures need
for s in tumor normal; do
  [ -f "$DEMO/COLO829_$s.coverage.bw" ] && continue
  curl -fL "$WF/COLO829/qc/coverage/COLO829_$s.regions.bed.gz" -o "cov_$s.bed.gz"
  # drop the alt/decoy contigs bedGraphToBigWig would reject as absent from .fai
  gzip -dc "cov_$s.bed.gz" | sort -k1,1 -k2,2n |
    awk 'NR==FNR{ok[$1];next} ($1 in ok)' hg38.chrom.sizes - > "cov_$s.bg"
  bedGraphToBigWig "cov_$s.bg" hg38.chrom.sizes "$DEMO/COLO829_$s.coverage.bw"
  rm -f "cov_$s.bg" "cov_$s.bed.gz"
done

# ------------------------------------------------ the multi-hop reconstruction
# `chains` is the search step and needs nothing but the VCF; its output is what
# supplies the --loci list below.
python3 "$HERE/sv_multihop.py" chains "$DEMO/COLO829.somatic-sv.vcf.gz" --min-hops 3

if [ ! -f "$DEMO/der3_RARB.derivative.fa.gz" ]; then
  python3 "$HERE/sv_multihop.py" derive \
    --aln "$TUMOUR_CRAM" --ref GRCh38.fa \
    --loci chr10:58717464,chr12:72273112,chr3:25359111 \
    --out der3_RARB --name der3_RARB_BICC1_TRHDE --threads 4
  bgzip -f -c der3_RARB.derivative.fa > "$DEMO/der3_RARB.derivative.fa.gz"
  samtools faidx "$DEMO/der3_RARB.derivative.fa.gz"
  cp der3_RARB.reads_vs_derivative.bam der3_RARB.reads_vs_derivative.bam.bai "$DEMO/"
  cp der3_RARB.vs_reference.paf "$DEMO/"
  # which reference interval each stretch of the contig came from; a gene track
  # cannot say this, since derivative windows usually sit inside one big intron
  sort -k1,1 -k2,2n der3_RARB.derivative_segments.bed |
    bgzip -f > "$DEMO/der3_RARB.derivative_segments.bed.gz"
  tabix -f -p bed "$DEMO/der3_RARB.derivative_segments.bed.gz"
  # make-pif writes <stem>.pif.gz next to its input, so run it where it lands
  (cd "$DEMO" && jb make-pif der3_RARB.vs_reference.paf)
fi

# --------------------------------------------------------- K562 Iso-Seq (ENCODE)
# Four PacBio runs across two ENCODE experiments; the released alignments are
# unsorted, so each is sorted before merging.
ENCODE_ISOSEQ=(ENCFF433YKW ENCFF092NLB ENCFF515YRZ ENCFF475XQX)
if [ ! -f "$DEMO/K562_isoseq.bam" ]; then
  sorted=()
  for f in "${ENCODE_ISOSEQ[@]}"; do
    [ -f "$f.bam" ] || curl -fL "https://www.encodeproject.org/files/$f/@@download/$f.bam" -o "$f.bam"
    [ -f "s_$f.bam" ] || samtools sort -@ 4 -o "s_$f.bam" "$f.bam"
    sorted+=("s_$f.bam")
  done
  samtools merge -@ 4 -f "$DEMO/K562_isoseq.bam" "${sorted[@]}"
  samtools index -@ 4 "$DEMO/K562_isoseq.bam"
fi

# ------------------------------------------------------------- K562 (DepMap 24Q4)
# Figshare file ids are per-release and stable; K562 is model ACH-000551, whose
# WGS copy-number profile is PR-aheaZL.
[ -f OmicsFusionFiltered.csv ] ||
  curl -fL "https://ndownloader.figshare.com/files/51065693" -o OmicsFusionFiltered.csv
[ -f OmicsCNSegmentsProfile.csv ] ||
  curl -fL "https://ndownloader.figshare.com/files/51065333" -o OmicsCNSegmentsProfile.csv

python3 "$HERE/depmap_to_jbrowse.py" fusions OmicsFusionFiltered.csv ACH-000551 \
  "$DEMO/K562.star-fusion.tsv"
if [ ! -f "$DEMO/K562_cn.bw" ]; then
  python3 "$HERE/depmap_to_jbrowse.py" segments OmicsCNSegmentsProfile.csv PR-aheaZL K562_cn.bedGraph
  sort -k1,1 -k2,2n K562_cn.bedGraph |
    awk 'NR==FNR{ok[$1];next} ($1 in ok)' hg38.chrom.sizes - > K562_cn.sorted.bedGraph
  bedGraphToBigWig K562_cn.sorted.bedGraph hg38.chrom.sizes "$DEMO/K562_cn.bw"
  rm -f K562_cn.bedGraph K562_cn.sorted.bedGraph
fi

# ------------------------------------------------- K562 DNA breakpoints (ENCODE)
# The DNA counterpart to the STAR-Fusion calls above, and the reason it is worth
# the lift: a fusion callset only ever sees a junction that is transcribed, so
# the RNA breakpoints sit at exon boundaries and say nothing about where the
# amplicon's edges are. DepMap's 24Q4 release has no structural-variant table at
# all (OmicsCNSegmentsProfile and OmicsFusionFiltered, no OmicsStructuralVariants),
# and ENCODE's four K562 WGS experiments are Illumina short reads on hg19. What
# does exist is one 10X Chromium linked-read run, ENCSR053AXS, whose large-SV
# call set carries both junctions of the BCR-ABL1 amplicon.
#
# hg19, so it is lifted. Both of a breakend's coordinates move, not just POS --
# see lift_bnd_vcf.py, which is where that is done and explained.
K562_10X_SV=ENCFF863MPP
if [ ! -f "$DEMO/K562.10x-large-sv.vcf.gz" ]; then
  [ -f "$K562_10X_SV.vcf.gz" ] ||
    curl -fL "https://www.encodeproject.org/files/$K562_10X_SV/@@download/$K562_10X_SV.vcf.gz" \
      -o "$K562_10X_SV.vcf.gz"
  # hgdownload.soe is the canonical host; the euro mirror keeps the same chain
  # under /gbdb and is the fallback when the US host is unreachable.
  [ -f hg19ToHg38.over.chain.gz ] ||
    curl -fsSL -o hg19ToHg38.over.chain.gz \
      "https://hgdownload.soe.ucsc.edu/goldenPath/hg19/liftOver/hg19ToHg38.over.chain.gz" ||
    curl -fsSL -o hg19ToHg38.over.chain.gz \
      "https://hgdownload-euro.soe.ucsc.edu/gbdb/hg19/liftOver/hg19ToHg38.over.chain.gz"
  if [ ! -x ./liftOver ]; then
    curl -fsSL -o liftOver "https://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/liftOver" ||
      curl -fsSL -o liftOver "https://hgdownload-euro.soe.ucsc.edu/admin/exe/linux.x86_64/liftOver"
    chmod +x liftOver
  fi
  python3 "$HERE/lift_bnd_vcf.py" "$K562_10X_SV.vcf.gz" hg19ToHg38.over.chain.gz \
    ./liftOver K562.10x-large-sv.hg38.vcf liftwork
  bgzip -f -c K562.10x-large-sv.hg38.vcf > "$DEMO/K562.10x-large-sv.vcf.gz"
  tabix -f -p vcf "$DEMO/K562.10x-large-sv.vcf.gz"
  rm -f K562.10x-large-sv.hg38.vcf
fi

# ------------------------------------------------------------------- JBrowse
[ -f "$APP/index.html" ] || jb create "$APP"

jb add-assembly https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz \
  --name hg38 --type bgzipFasta \
  --refNameAliases https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt \
  --out "$APP" --force
jb add-assembly "$DEMO/der3_RARB.derivative.fa.gz" \
  --name der3_RARB_BICC1_TRHDE --type bgzipFasta --load copy --out "$APP" --force

jb add-track https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz \
  --indexFile https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi \
  --name 'NCBI RefSeq genes' --trackId ncbi_refseq_hg38 \
  --assemblyNames hg38 --out "$APP" --force

jb add-track "$DEMO/COLO829.somatic-sv.vcf.gz" --load copy \
  --name 'COLO829 somatic SVs (nanomonsv)' --trackId COLO829_somatic_sv \
  --assemblyNames hg38 --out "$APP" --force
jb add-track "$TUMOUR_CRAM" \
  --name 'COLO829 tumour (ONT R10, haplotagged)' --trackId COLO829_tumor_ont \
  --assemblyNames hg38 --out "$APP" --force
jb add-track "$NORMAL_BAM" \
  --name 'COLO829BL matched normal (ONT R10)' --trackId COLO829BL_normal_ont \
  --assemblyNames hg38 --out "$APP" --force
for s in tumor normal; do
  jb add-track "$DEMO/COLO829_$s.coverage.bw" --load copy \
    --name "COLO829 $s coverage (50 kb bins)" --trackId "COLO829_${s}_coverage" \
    --assemblyNames hg38 --out "$APP" --force
done

jb add-track "$DEMO/der3_RARB.vs_reference.pif.gz" --load copy \
  --name 'Derivative allele vs hg38' --trackId der3_vs_hg38 \
  --assemblyNames der3_RARB_BICC1_TRHDE,hg38 --out "$APP" --force
jb add-track "$DEMO/der3_RARB.derivative_segments.bed.gz" --load copy \
  --name 'Where each segment came from' --trackId der3_segments \
  --assemblyNames der3_RARB_BICC1_TRHDE --out "$APP" --force
jb add-track "$DEMO/der3_RARB.reads_vs_derivative.bam" --load copy \
  --name 'Spanning reads realigned to the derivative' --trackId reads_vs_der3 \
  --assemblyNames der3_RARB_BICC1_TRHDE --out "$APP" --force

jb add-track "$DEMO/K562_isoseq.bam" --load copy \
  --name 'K562 PacBio Iso-Seq (ENCODE)' --trackId K562_isoseq \
  --assemblyNames hg38 --out "$APP" --force
jb add-track "$DEMO/K562.star-fusion.tsv" --load copy \
  --name 'K562 STAR-Fusion calls (DepMap 24Q4)' --trackId K562_star_fusion \
  --assemblyNames hg38 --out "$APP" --force
jb add-track "$DEMO/K562_cn.bw" --load copy \
  --name 'K562 copy-number segments (DepMap WGS)' --trackId K562_cn \
  --assemblyNames hg38 --out "$APP" --force
jb add-track "$DEMO/K562.10x-large-sv.vcf.gz" --load copy \
  --name 'K562 DNA breakpoints (10X linked reads, lifted to hg38)' \
  --trackId K562_10x_sv --assemblyNames hg38 --out "$APP" --force

jb text-index --out "$APP" --force || true

echo
echo "Done. Serve it with:"
echo "  npx --yes serve $(pwd)/$APP"
