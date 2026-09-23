#!/usr/bin/env bash
#
# A deletion read off a BAM's fields alone, the dataset behind
# website/docs/tutorials/read_marks.md.
#
# One alignment file becomes two mark-display tracks. The reads themselves,
# drawn by a display that plots a read's fields: depth as a coverage step,
# each pair's insert size as a point, the reads stacked and coloured by that
# insert. And a BED of every pair whose insert exceeds 1 kb, cut out of the
# same file with samtools, which the display bins and counts along the whole
# chromosome where the reads are too many to fetch.
#
# With no arguments it reads NA12878's 30x Illumina CRAM from the 1000 Genomes
# high-coverage release over HTTP and scans chromosome 20. Given your own
# BAM or CRAM and the FASTA it was aligned to, it builds the same two tracks
# over your file; CHROM picks the chromosome to scan.
#
# Requires: samtools, bcftools, bgzip + tabix (htslib), curl, awk, and node
#           (the JBrowse CLI is fetched via npx unless `jbrowse` is on PATH).
# Usage:    bash scripts/build_read_marks.sh [outdir]
#           bash scripts/build_read_marks.sh reads.cram genome.fa [outdir]
#           CHROM=chr1 bash scripts/build_read_marks.sh ...
#
set -euo pipefail

for tool in samtools bcftools bgzip tabix curl awk node; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

abspath() { case "$1" in /*) printf '%s\n' "$1" ;; *) printf '%s\n' "$PWD/$1" ;; esac; }

CHROM="${CHROM:-chr20}"
KG=https://s3.amazonaws.com/1000genomes/1000G_2504_high_coverage
CRAM_URL="$KG/data/ERR3239334/NA12878.final.cram"
SV_VCF=https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20210124.SV_Illumina_Integration/1KGP_3202.gatksv_svtools_novelins.freeze_V3.wAF.vcf.gz
UCSC=https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips

if [ $# -ge 2 ]; then
  READS=$(abspath "$1")
  GENOME=$(abspath "$2")
  OUTDIR="${3:-read_marks_build}"
  ASM=$(basename "$GENOME")
  ASM=${ASM%.gz}
  ASM=${ASM%.fa}
  ASM=${ASM%.fasta}
  ASM=${ASM%.fna}
  SAMPLE=$(basename "$READS")
  SAMPLE=${SAMPLE%.*}
else
  READS="$CRAM_URL"
  GENOME=""
  OUTDIR="${1:-read_marks_build}"
  ASM=hg38
  SAMPLE=NA12878
  # The 1000 Genomes CRAMs name a reference path that exists on their cluster
  # and nowhere else; htslib falls back to fetching each sequence by MD5 from
  # the ENA's cache when REF_PATH names it.
  export REF_PATH='https://www.ebi.ac.uk/ena/cram/md5/%s'
fi

mkdir -p "$OUTDIR"
cd "$OUTDIR"
APP=jbrowse2

# ── The pairs over 1 kb ─────────────────────────────────────────────────────
# One row per read pair whose insert exceeds 1 kb, from the leftmost mate
# (TLEN positive) to the end of the insert. -q 20 drops reads that cannot be
# placed, -F 0x904 drops unmapped, secondary and supplementary records, and
# required_fields asks the CRAM decoder for the columns the row needs and no
# sequence, which is most of the decode. The header line names the columns,
# so `tlen` and `score` (the mapping quality) are field names the track reads.
PAIRS="$SAMPLE.$CHROM.discordant_pairs.bed.gz"
samtools view -q 20 -F 0x904 --input-fmt-option required_fields=0x1DF "$READS" "$CHROM" |
  awk 'BEGIN { OFS = "\t"; print "#chrom", "chromStart", "chromEnd", "name", "score", "strand", "tlen" }
    $7 == "=" && $9 > 1000 { print $3, $4 - 1, $4 - 1 + $9, $1, $5, "+", $9 }' |
  bgzip >"$PAIRS"
tabix -f -p bed "$PAIRS"

# ── JBrowse ─────────────────────────────────────────────────────────────────
[ -f "$APP/index.html" ] || jb create "$APP"
if [ -n "$GENOME" ]; then
  jb add-assembly "$GENOME" --name "$ASM" --load copy --force --out "$APP"
  cp -f "$READS" "$APP/"
  [ -f "$READS.crai" ] && cp -f "$READS.crai" "$APP/"
  [ -f "$READS.bai" ] && cp -f "$READS.bai" "$APP/"
  READS_URI=$(basename "$READS")
else
  jb add-assembly "$UCSC/hg38.2bit" --name hg38 --type twoBit --force --out "$APP"
  READS_URI="$READS"
fi
cp -f "$PAIRS" "$PAIRS.tbi" "$APP"/

case "$READS_URI" in
  *.cram) ADAPTER="{ \"type\": \"CramAdapter\", \"cramLocation\": { \"uri\": \"$READS_URI\" }, \"craiLocation\": { \"uri\": \"$READS_URI.crai\" } }" ;;
  *) ADAPTER="{ \"type\": \"BamAdapter\", \"bamLocation\": { \"uri\": \"$READS_URI\" }, \"index\": { \"location\": { \"uri\": \"$READS_URI.bai\" } } }" ;;
esac

# The CLI cannot write a marks list, so every track is JSON. @PLACEHOLDERS@
# are real JSON strings, so the heredocs parse on their own.
#
# The depth and the insert size are two quantities and a mark display draws one
# axis, so each takes a track of its own over the same file.
sed -e "s|@ASSEMBLY@|$ASM|g" -e "s|@SAMPLE@|$SAMPLE|g" -e "s|\"@ADAPTER@\"|$ADAPTER|g" >depth.json <<'JSON'
{
  "type": "AlignmentsTrack",
  "trackId": "@SAMPLE@_read_depth",
  "name": "@SAMPLE@ depth",
  "assemblyNames": ["@ASSEMBLY@"],
  "adapter": "@ADAPTER@",
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "@SAMPLE@_read_depth-LinearMarkDisplay",
      "marks": [
        {
          "mark": "bar",
          "transform": [{ "type": "coverage" }],
          "encoding": { "y": "coverage", "color": "#c8d8ee" }
        }
      ]
    }
  ]
}
JSON
jb add-track-json depth.json --out "$APP" --update

sed -e "s|@ASSEMBLY@|$ASM|g" -e "s|@SAMPLE@|$SAMPLE|g" -e "s|\"@ADAPTER@\"|$ADAPTER|g" >reads.json <<'JSON'
{
  "type": "AlignmentsTrack",
  "trackId": "@SAMPLE@_read_marks",
  "name": "@SAMPLE@ insert size",
  "assemblyNames": ["@ASSEMBLY@"],
  "adapter": "@ADAPTER@",
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "@SAMPLE@_read_marks-LinearMarkDisplay",
      "marks": [
        {
          "mark": "point",
          "transform": [
            {
              "type": "filter",
              "expr": "jexl:feature.template_length > 0 && feature.template_length < 8000"
            }
          ],
          "encoding": {
            "y": "template_length",
            "color": {
              "field": "score",
              "scale": "linear",
              "domainMin": 0,
              "domainMax": 60,
              "range": ["#bdbdbd", "#1f4e9a"]
            }
          }
        }
      ]
    }
  ]
}
JSON
jb add-track-json reads.json --out "$APP" --update

# Two tracks scan the chromosome: every pair under 20 kb as a point at its
# insert, and under it the count per zoom-following bin of the deletion-sized
# pairs, on an axis pinned at 60 so a deletion is a bar and the centromere,
# whose pairs run into the thousands, saturates.
sed -e "s|@ASSEMBLY@|$ASM|g" -e "s|@SAMPLE@|$SAMPLE|g" -e "s|@CHROM@|$CHROM|g" -e "s|@PAIRS@|$PAIRS|g" >pairs.json <<'JSON'
{
  "type": "FeatureTrack",
  "trackId": "@SAMPLE@_@CHROM@_pairs",
  "name": "@SAMPLE@ @CHROM@, pairs over 1 kb",
  "assemblyNames": ["@ASSEMBLY@"],
  "adapter": {
    "type": "BedTabixAdapter",
    "bedGzLocation": { "uri": "@PAIRS@" },
    "index": { "location": { "uri": "@PAIRS@.tbi" } }
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "@SAMPLE@_@CHROM@_pairs-LinearMarkDisplay",
      "marks": [
        {
          "mark": "point",
          "transform": [{ "type": "filter", "expr": "jexl:feature.tlen < 20000" }],
          "encoding": {
            "x2": "start",
            "y": "tlen",
            "color": {
              "field": "score",
              "scale": "linear",
              "domainMin": 0,
              "domainMax": 60,
              "range": ["#bdbdbd", "#1f4e9a"]
            }
          }
        }
      ]
    }
  ]
}
JSON
jb add-track-json pairs.json --out "$APP" --update

sed -e "s|@ASSEMBLY@|$ASM|g" -e "s|@SAMPLE@|$SAMPLE|g" -e "s|@CHROM@|$CHROM|g" -e "s|@PAIRS@|$PAIRS|g" >counts.json <<'JSON'
{
  "type": "FeatureTrack",
  "trackId": "@SAMPLE@_@CHROM@_pair_counts",
  "name": "@SAMPLE@ @CHROM@, pairs of 2 to 10 kb per bin",
  "assemblyNames": ["@ASSEMBLY@"],
  "adapter": {
    "type": "BedTabixAdapter",
    "bedGzLocation": { "uri": "@PAIRS@" },
    "index": { "location": { "uri": "@PAIRS@.tbi" } }
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "@SAMPLE@_@CHROM@_pair_counts-LinearMarkDisplay",
      "scales": { "y": { "domainMin": 0, "domainMax": 60 } },
      "marks": [
        {
          "mark": "bar",
          "transform": [
            { "type": "filter", "expr": "jexl:feature.tlen > 2000 && feature.tlen < 10000" },
            { "type": "bin", "step": "auto" },
            { "type": "aggregate", "ops": [{ "op": "count" }] }
          ],
          "encoding": { "y": "count", "color": "#d62728" }
        }
      ]
    }
  ]
}
JSON
jb add-track-json counts.json --out "$APP" --update

# ── The callset's answer ────────────────────────────────────────────────────
# What the 1000 Genomes SV callset says NA12878 carries on the same chromosome,
# for reading the count mark against: every deletion over 2 kb on a non-reference
# genotype, with the evidence that called it.
if [ -z "$GENOME" ]; then
  bcftools view -s NA12878 "$SV_VCF" "$CHROM" |
    bcftools query -i 'GT="alt" && INFO/SVTYPE="DEL" && INFO/SVLEN<-2000' \
      -f '%CHROM\t%POS\t%END\t%INFO/SVLEN\t[%GT]\t%INFO/AF\t%INFO/EVIDENCE\n' |
    tee "$SAMPLE.$CHROM.deletions.tsv"
fi

echo "built $OUTDIR/$APP; serve it with: npx --yes serve $OUTDIR/$APP"
