#!/bin/bash
#
# Builds the data behind website/docs/tutorials/cancer_sv.md (complex somatic
# rearrangements and gene fusions), everything pinned:
#
#   COLO829 / COLO829BL  ONT R10 somatic SV calls and coverage from the ONT
#                        open-data release, plus the published RARB/BICC1/TRHDE
#                        derivative contig, which this script fetches rather than
#                        rebuilds -- see ADR-140
#   K562                 ENCODE PacBio Iso-Seq alignments, DepMap 24Q4
#                        STAR-Fusion calls and copy-number segments, and the
#                        10X linked-read DNA breakpoints lifted from hg19
#
# The tumour CRAM and the normal BAM are streamed from the ONT bucket rather than
# downloaded; only the reconstruction outputs are written locally.
#
# Requires: samtools, bedGraphToBigWig, bgzip, tabix, curl, python3, node>=18
#           The UCSC liftOver binary is downloaded into the output directory;
#           nothing is installed.
# Usage:    bash scripts/build_cancer_sv_demo.sh [outdir]
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)

# downloads to "$out.part" and moves it into place on success, so a run killed
# mid-download is never mistaken next time for one that finished
fetch() {
  local url=$1 out=$2; shift 2
  curl "$@" -o "$out.part" "$url" && mv "$out.part" "$out"
}

# fetched on demand so a bare `curl -O` of this one script still works
HELPERS=(depmap_to_jbrowse.py lift_bnd_vcf.py)
for h in "${HELPERS[@]}"; do
  [ -f "$HERE/$h" ] || fetch \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h" \
    "$HERE/$h" -fsSL
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

# drops rows for the alt/decoy contigs bedGraphToBigWig would otherwise reject
# as absent from .fai; $1 is a bedGraph or bedGraph.gz, $2 the bigWig to write
bg_to_bigwig() {
  local src=$1 bw=$2
  local tmp="$bw.bg"
  case "$src" in
    *.gz) gzip -dc "$src" ;;
    *) cat "$src" ;;
  esac | sort -k1,1 -k2,2n |
    awk 'NR==FNR{ok[$1];next} ($1 in ok)' hg38.chrom.sizes - > "$tmp"
  bedGraphToBigWig "$tmp" hg38.chrom.sizes "$bw"
  rm -f "$tmp" "$src"
}

ONT=https://ont-open-data.s3.amazonaws.com/colo829_2024.03
WF="$ONT/wf_somatic_variation/sup"
TUMOUR_CRAM="$WF/COLO829_tumor.ht.cram"
NORMAL_BAM="$ONT/basecalls/colo829bl/sup/PAU59807.d052sup4305mCG_5hmCGvHg38.bam"

# ---------------------------------------------------------------- reference
# The same GRCh38 build the ONT alignments used; samtools needs it to decode the
# CRAM, and sv_multihop.py aligns against it.
[ -f GRCh38.fa ] ||
  fetch "$WF/GCA_000001405.15_GRCh38_no_alt_analysis_set.fasta" GRCh38.fa -fL
[ -f GRCh38.fa.fai ] ||
  fetch "$WF/GCA_000001405.15_GRCh38_no_alt_analysis_set.fasta.fai" GRCh38.fa.fai -fL
cut -f1,2 GRCh38.fa.fai > hg38.chrom.sizes

# ------------------------------------------------------- COLO829 SV calls
[ -f "$DEMO/COLO829.somatic-sv.vcf.gz" ] ||
  fetch "$WF/COLO829.wf-somatic-sv.vcf.gz" "$DEMO/COLO829.somatic-sv.vcf.gz" -fL
[ -f "$DEMO/COLO829.somatic-sv.vcf.gz.tbi" ] ||
  fetch "$WF/COLO829.wf-somatic-sv.vcf.gz.tbi" "$DEMO/COLO829.somatic-sv.vcf.gz.tbi" -fL

# mosdepth's 50 kb windows, which is all the copy-number resolution the figures need
for s in tumor normal; do
  [ -f "$DEMO/COLO829_$s.coverage.bw" ] && continue
  curl -fL "$WF/COLO829/qc/coverage/COLO829_$s.regions.bed.gz" -o "cov_$s.bed.gz"
  bg_to_bigwig "cov_$s.bed.gz" "$DEMO/COLO829_$s.coverage.bw"
done

# ------------------------------------------------ the der(3) derivative contig
# Fetched, not rebuilt. The published contig is a consensus of the 29 tumour
# reads that span all three loci, built by a script this repository no longer
# ships: assembling an allele is an assembler's job, and shipping our own
# half of one is what ADR-140 ends. To rebuild from the reads rather than
# download, assemble them locally -- Flye, Shasta and hifiasm all do this -- and
# put the contig through the same `jb make-pif` step below.
DER3=(
  der3_RARB.derivative.fa.gz
  der3_RARB.derivative.fa.gz.fai
  der3_RARB.derivative.fa.gz.gzi
  der3_RARB.reads_vs_derivative.bam
  der3_RARB.reads_vs_derivative.bam.bai
  der3_RARB.derivative_segments.bed.gz
  der3_RARB.derivative_segments.bed.gz.tbi
  der3_RARB.vs_reference.pif.gz
  der3_RARB.vs_reference.pif.gz.tbi
  der3_RARB.vs_reference.pif.gz.gzi
)
for f in "${DER3[@]}"; do
  [ -f "$DEMO/$f" ] || fetch "https://jbrowse.org/demos/cancer_sv/$f" "$DEMO/$f" -fL
done

# --------------------------------------------------------- K562 Iso-Seq (ENCODE)
# Four PacBio runs across two ENCODE experiments; the released alignments are
# unsorted, so each is sorted before merging.
ENCODE_ISOSEQ=(ENCFF433YKW ENCFF092NLB ENCFF515YRZ ENCFF475XQX)
if [ ! -f "$DEMO/K562_isoseq.bam.bai" ]; then
  sorted=()
  for f in "${ENCODE_ISOSEQ[@]}"; do
    [ -f "$f.bam" ] || fetch "https://www.encodeproject.org/files/$f/@@download/$f.bam" "$f.bam" -fL
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
  fetch "https://ndownloader.figshare.com/files/51065693" OmicsFusionFiltered.csv -fL
[ -f OmicsCNSegmentsProfile.csv ] ||
  fetch "https://ndownloader.figshare.com/files/51065333" OmicsCNSegmentsProfile.csv -fL

python3 "$HERE/depmap_to_jbrowse.py" fusions OmicsFusionFiltered.csv ACH-000551 \
  "$DEMO/K562.star-fusion.tsv"
if [ ! -f "$DEMO/K562_cn.bw" ]; then
  python3 "$HERE/depmap_to_jbrowse.py" segments OmicsCNSegmentsProfile.csv PR-aheaZL K562_cn.bedGraph
  bg_to_bigwig K562_cn.bedGraph "$DEMO/K562_cn.bw"
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
if [ ! -f "$DEMO/K562.10x-large-sv.vcf.gz.tbi" ]; then
  [ -f "$K562_10X_SV.vcf.gz" ] ||
    fetch "https://www.encodeproject.org/files/$K562_10X_SV/@@download/$K562_10X_SV.vcf.gz" \
      "$K562_10X_SV.vcf.gz" -fL
  # hgdownload.soe is the canonical host; the euro mirror keeps the same chain
  # under /gbdb and is the fallback when the US host is unreachable.
  [ -f hg19ToHg38.over.chain.gz ] ||
    fetch "https://hgdownload.soe.ucsc.edu/goldenPath/hg19/liftOver/hg19ToHg38.over.chain.gz" \
      hg19ToHg38.over.chain.gz -fsSL ||
    fetch "https://hgdownload-euro.soe.ucsc.edu/gbdb/hg19/liftOver/hg19ToHg38.over.chain.gz" \
      hg19ToHg38.over.chain.gz -fsSL
  if [ ! -x ./liftOver ]; then
    case "$(uname -s)-$(uname -m)" in
      Linux-x86_64) UCSC_OS=linux.x86_64 ;;
      Darwin-x86_64) UCSC_OS=macOSX.x86_64 ;;
      Darwin-arm64) UCSC_OS=macOSX.arm64 ;;
      *) echo "no UCSC liftOver build for $(uname -s) $(uname -m)" >&2; exit 1 ;;
    esac
    fetch "https://hgdownload.soe.ucsc.edu/admin/exe/$UCSC_OS/liftOver" liftOver -fsSL ||
      fetch "https://hgdownload-euro.soe.ucsc.edu/admin/exe/$UCSC_OS/liftOver" liftOver -fsSL
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

jb text-index --out "$APP" --force

echo
echo "Done. Serve it with:"
echo "  npx --yes serve $(pwd)/$APP"
