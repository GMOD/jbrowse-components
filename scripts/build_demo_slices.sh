#!/bin/bash
#
# Rebuilds the three region-sliced BAMs hosted under jbrowse.org/demos/, which
# back the alignments figures in the user guides and the HG008 somatic demo:
#
#   demos/hg002/HG002.ONTrel2.HP.hs37d5.demo_slices.bam
#   demos/hg002/HG002.hs37d5.2x250.demo_slices.bam
#   demos/cgiab/HG008-T_PacBio-HiFi-Revio_116x.demo_slices.bam
#
# A slice is `samtools view` over a handful of regions of a public GIAB
# alignment. The point is weight: the sources are whole-genome BAMs in the tens
# to hundreds of GB, and each figure needs three windows, so the demo copies are
# a few MB and load over range requests from a static bucket.
#
# WHERE THE REGIONS CAME FROM. They were not written down anywhere in this repo,
# and they did not have to be: `samtools view` records its own command line as
# an @PG line in the output header, so each hosted slice carries the source URL
# and the exact regions it was cut from. Recovered with
#
#   samtools view -H <slice>.bam | grep -oE 'CL:samtools view -b -o .*'
#
# which is worth knowing generally -- a sliced BAM whose provenance is lost is
# usually still self-describing. The two HG002 slices use identical regions
# because the figures compare platforms at one locus.
#
# The regions are hs37d5-style (no chr) for the HG002 pair and GRCh38-style for
# HG008; that difference is the assembly, not an inconsistency.
#
# Requires: samtools (1.10+, for remote BAM over https)
# Usage:    bash scripts/build_demo_slices.sh [outdir]
set -euo pipefail

OUTDIR="${1:-demo_slices_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

GIAB=https://ftp-trace.ncbi.nlm.nih.gov

# The two HG002 windows are the same on both platforms: MRPL53/spliced-read
# locus, a second chr1 window, and the ~45 kb one the coverage figures use.
HG002_REGIONS=(1:55690000-55722000 1:62990000-63022000 1:161155000-161200000)

ONT_SRC="$GIAB/giab/ftp/data/AshkenazimTrio/HG002_NA24385_son/Ultralong_OxfordNanopore/combined_2018-08-10/HG002_ONTrel2_16x_RG_HP10xtrioRTG.cram.bam"
ILL_SRC="$GIAB/ReferenceSamples/giab/data/AshkenazimTrio/HG002_NA24385_son/NIST_Illumina_2x250bps/novoalign_bams/HG002.hs37d5.2x250.bam"
HG008_SRC="$GIAB/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam"

slice() { # slice <out> <src> <region>...
  local out=$1 src=$2
  shift 2
  if [ -s "$out" ]; then
    echo "== $out (exists, skipping)"
  else
    echo "== $out"
    samtools view -b -o "$out" "$src" "$@"
    samtools index "$out"
  fi
  samtools idxstats "$out" | awk '$3>0 {n+=$3} END {print "   mapped reads:", n+0}'
}

# Haplotagged (HP tag) ONT, which is what the haplotype figures colour by.
slice HG002.ONTrel2.HP.hs37d5.demo_slices.bam "$ONT_SRC" "${HG002_REGIONS[@]}"
slice HG002.hs37d5.2x250.demo_slices.bam "$ILL_SRC" "${HG002_REGIONS[@]}"

# HG008 tumour, GRCh38.
#
# A REGION MUST CONTAIN EVERY WINDOW THAT DISPLAYS ITS READS, with room to
# spare. Depth inside a region is exact -- a read covering a position inside
# [S,E] overlaps [S,E], so it survives the cut -- but outside one it decays over
# a read length, because only reads reaching back into the region are kept. That
# decay is smooth, it looks like coverage, and nothing in the app marks it. The
# first chr3 cut was 139966414-139986414, which stopped 18 kb short of the
# callset figure's window: real depth DOUBLES over the second breakend there
# (57x -> 107x) and the slice fell to 9x, so a pileup drew a collapse where the
# data has a gain. Widen the region rather than trusting a window's edge.
#
# chr3 spans the derivative-reconstruction window (139,936,789-) through the
# callset comparison's (-140,005,000); chr13 spans the reconstruction's other
# arm; chr9 is the CDKN2A neighbourhood.
slice HG008-T_PacBio-HiFi-Revio_116x.demo_slices.bam "$HG008_SRC" \
  chr3:139930000-140010000 chr13:114310000-114365000 chr9:21920000-22000000

echo
echo "Built in $PWD. Upload alongside the configs in demos/ -- see"
echo "scripts/deploy-demo.sh; never aws s3 cp a config from elsewhere."
