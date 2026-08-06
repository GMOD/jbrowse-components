#!/usr/bin/env bash
#
# Every number website/docs/tutorials/mappability_qc.md quotes, measured from
# the same files the tutorial's figures draw.
#
# Four independent measurements of one thing — whether a short read can be
# placed at a locus — over the SMN1/SMN2 pair and two ordinary control genes:
#
#   1. Umap k100 multi-read mappability (the annotation)
#   2. gnomAD v3 mean genome coverage over 76k samples (an aggregate outcome)
#   3. which problematic-region tracks flag the locus (three groups' opinions)
#   4. MAPQ 0 fraction in one 30x sample (the reads themselves)
#
# Plus the chromosome-wide stratification the page uses to say what the region
# annotations do and do not imply about a callset.
#
# Requires: kent tools (bigWigInfo, bigWigToBedGraph, bigBedToBed), bedtools,
#           samtools (>= 1.10, with libcurl), curl, awk.
# Usage:    bash scripts/scan_mappability_qc.sh [outdir]
set -euo pipefail

OUTDIR="${1:-mappability_qc_scan}"
GBDB=https://hgdownload.soe.ucsc.edu/gbdb/hg38

# The Umap k100 track: for each position, the fraction of overlapping 100-mers
# that map uniquely. Positions where NO 100-mer is unique are absent from the
# file rather than stored as zero, so "how much of this gene has a value at all"
# is the strongest of the three numbers reported per locus.
UMAP=$GBDB/hoffmanMappability/k100.Umap.MultiTrackMappability.bw

# gnomAD v3 genome coverage, averaged over its 76,156 samples. gnomAD drops
# non-uniquely-placed reads before computing it, so this is what the Umap
# annotation predicts, measured on real data by someone else.
GNOMAD=$GBDB/gnomAD/coverage/v3-genome/gnomad.coverage.mean.bw

# NA12878 at 30x, GRCh38, from the 1000 Genomes high-coverage release. Any
# 30x short-read genome would do; this one is public, CORS-enabled, and is the
# track the tutorial's read figure draws.
CRAM=https://s3.amazonaws.com/1000genomes/1000G_2504_high_coverage/data/ERR3239334/NA12878.final.cram

# hg38 gene bodies, and two controls every measurement below is read against.
#
# SMN1 and SMN2 are a 99.9%-identical pair ~900 kb apart on chr5. The first
# control is deliberately the nearest thing to them that is ordinary sequence:
# 30 kb over the 5' end of BDP1, 500 kb past the end of both flagged intervals,
# so it is the same sample, the same library and the same chromosome, and takes
# a window of the same width. Anything that survives that comparison is not a
# property of the sample. ACTB is the second control, on another chromosome, to
# show the near one is not itself unusual.
LOCI="chr5:70924940-70953012:SMN1
chr5:70049523-70077595:SMN2
chr5:71455000-71485000:BDP1_5prime
chr7:5527151-5530601:ACTB"

# chr5 length, GRCh38.
CHR5_LEN=181538259

mkdir -p "$OUTDIR"
cd "$OUTDIR"

# The kent bigBed tools are commonly built without https support ("No openssl
# available in netConnectHttps"), while the bigWig ones in the same install may
# have it. Reading the bigBeds from a local copy sidesteps the difference, and
# makes a re-run free.
fetch() {
  [ -f "$2" ] || curl -fsSL -o "$2" "$1"
}

echo "== 1. Umap k100 multi-read mappability"
bigWigInfo "$UMAP" | awk '/^mean:|^basesCovered:/ {print "   genome " $0}'
echo "   locus                  has a value    mean where present    below 0.5"
echo "$LOCI" | while IFS=: read -r chrom range label; do
  start=${range%-*}
  end=${range#*-}
  bigWigToBedGraph -chrom="$chrom" -start="$start" -end="$end" "$UMAP" stdout |
    awk -v n="$label" -v s="$start" -v e="$end" '
      {w=$3-$2; tot+=$4*w; cov+=w; if ($4<0.5) low+=w}
      END {
        len=e-s
        if (cov==0) { printf "   %-22s %13s\n", n, "0%" }
        else { printf "   %-22s %12.1f%% %20.2f %12.1f%%\n", n, 100*cov/len, tot/cov, 100*low/cov }
      }'
done

echo
echo "== 2. gnomAD v3 mean genome coverage (76,156 samples)"
echo "$LOCI" | while IFS=: read -r chrom range label; do
  start=${range%-*}
  end=${range#*-}
  bigWigToBedGraph -chrom="$chrom" -start="$start" -end="$end" "$GNOMAD" stdout |
    awk -v n="$label" '
      {w=$3-$2; tot+=$4*w; cov+=w}
      END { printf "   %-22s mean depth %6.1fx\n", n, tot/cov }'
done

echo
echo "== 3. Problematic-region tracks covering the SMN locus (chr5:70.0-71.0 Mb)"
for bb in problematic/encBlacklist problematic/grcExclusions problematic/comments \
  problematic/GIAB/alllowmapandsegdupregions; do
  name=$(basename "$bb")
  fetch "$GBDB/$bb.bb" "$name.bb"
  hits=$(bigBedToBed -chrom=chr5 -start=70000000 -end=71000000 "$name.bb" stdout)
  if [ -z "$hits" ]; then
    printf "   %-32s no interval here\n" "$name"
  else
    printf "   %-32s %s\n" "$name" \
      "$(echo "$hits" | awk '{lab=""; for (i=4; i<=NF; i++) lab=lab $i " "; printf "chr5:%d-%d %s", $2, $3, lab}')"
  fi
done

echo
echo "== 4. Reads at each locus in NA12878 (30x GRCh38), by mapping quality"
echo "$LOCI" | while IFS=: read -r chrom range label; do
  # required_fields skips sequence decoding, so no reference is needed to count.
  reads=$(samtools view --input-fmt-option required_fields=0x87F -c "$CRAM" "$chrom:$range")
  placed=$(samtools view --input-fmt-option required_fields=0x87F -c -q 1 "$CRAM" "$chrom:$range")
  awk -v n="$label" -v r="$reads" -v p="$placed" \
    'BEGIN { printf "   %-22s %6d reads, %5.1f%% at MAPQ 0\n", n, r, 100*(r-p)/r }'
done

echo
echo "== 5. What the GIAB low-mappability + segdup regions hold, across chr5"
# The regions are 8% of the chromosome. If a callset were indifferent to them it
# would put 8% of its calls there. Both callsets put more — which is partly real
# biology, because segmental duplications genuinely vary in copy number, so this
# measures enrichment and NOT a false-positive rate.
bigBedToBed -chrom=chr5 alllowmapandsegdupregions.bb chr5.lowmap.bed
sort -k1,1 -k2,2n chr5.lowmap.bed >chr5.lowmap.sorted.bed
awk -v len=$CHR5_LEN '{s+=$3-$2} END {printf "   regions cover %.1f%% of chr5\n", 100*s/len}' \
  chr5.lowmap.bed

for pair in dgv/dgvMerged:dgvMerged lrSv/1kgOnt:1kgOnt; do
  path=${pair%:*}
  name=${pair#*:}
  fetch "$GBDB/$path.bb" "$name.bb"
  bigBedToBed -chrom=chr5 "$name.bb" "$name.chr5.bed"
  # Midpoints, not intervals: a DGV record has a median size in the hundreds of
  # bp while a 1KG ONT record is anchored at a point, so asking whether either
  # OVERLAPS a region scores the bigger callset higher for being bigger. That
  # length bias is worth 25 points here — 43.5% of DGV records overlap a region
  # against 18.3% whose midpoint is in one — which is enough to invent a
  # difference between the two callsets that isn't there.
  awk -v OFS='\t' '{m=int(($2+$3)/2); print $1, m, m+1}' "$name.chr5.bed" |
    sort -k1,1 -k2,2n >"$name.mid.bed"
  total=$(wc -l <"$name.mid.bed")
  inside=$(bedtools intersect -a "$name.mid.bed" -b chr5.lowmap.sorted.bed -u -sorted | wc -l)
  awk -v n="$name" -v t="$total" -v i="$inside" \
    'BEGIN { printf "   %-12s %6d chr5 calls, %5.1f%% of midpoints inside\n", n, t, 100*i/t }'
done

echo
echo "   The block over SMN, against the flank on either side of it — three"
echo "   windows of about the same width, so the counts are comparable:"
echo "                 left flank      SMN block       right flank"
echo "                 68.00-69.53 Mb  69.53-71.01 Mb  71.01-72.50 Mb"
for name in dgvMerged 1kgOnt; do
  left=$(bigBedToBed -chrom=chr5 -start=68000000 -end=69533889 "$name.bb" stdout | wc -l)
  block=$(bigBedToBed -chrom=chr5 -start=69533889 -end=71009585 "$name.bb" stdout | wc -l)
  right=$(bigBedToBed -chrom=chr5 -start=71009585 -end=72500000 "$name.bb" stdout | wc -l)
  printf "   %-12s %10s %15s %16s\n" "$name" "$left" "$block" "$right"
done
