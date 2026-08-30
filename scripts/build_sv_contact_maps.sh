#!/usr/bin/env bash
#
# Reproducibly build the NA12878 read-pair SV contact-map demo shown in
# website/docs/tutorials/sv_contact_maps.md, and lay the result out for
# jbrowse.org/demos/sv_contact_maps/.
#
# It slices three known structural variants out of the GIAB HG001 300x Illumina
# BAM by URL (no whole-genome download), turns those reads into the four Cue
# channels as .hic files with sv_contact_maps.py, and filters the 1000 Genomes
# phase 3 SV callset down to NA12878's non-reference calls.
#
# THE SLICES ARE WIDER THAN ANY WINDOW THE TUTORIAL SHOWS, by about 45 kb on
# each side. Depth inside a cut region is the source BAM's exactly; outside one
# it decays over a read length, smoothly and with nothing marking the edge. The
# depth-difference channel is a picture OF depth, so a slice cut to the figure's
# own window would draw a copy-number step at each frame edge that is not in the
# data.
#
# The three loci, all NA12878 calls in the 1000 Genomes phase 3 SV map:
#   7:70,420,799-70,438,952   18 kb inversion, heterozygous, delly
#   5:175,353,978-175,371,353 17 kb duplication, homozygous, genome-STRiP
#   17:16,661,446-16,704,453  43 kb duplication, genome-STRiP
# The two duplications are DUP_gs calls, made on depth alone. The 300x BAM holds
# no read pair joining either one's breakpoints, so they light the depth channel
# and leave every pair channel empty -- which is the tutorial's control.
#
# Data (cite both):
#   Zook JM et al. Extensive sequencing of seven human genomes to characterize
#   benchmark reference materials. Sci Data 2016;3:160025.
#   Sudmant PH et al. An integrated map of structural variation in 2,504 human
#   genomes. Nature 2015;526:75-81.
#
# Requires: samtools, bcftools, tabix, curl, java (17+; Debian/Ubuntu:
#           apt install default-jre) and python3. juicer_tools is downloaded
#           into the output directory by the python helper.
# Time:     ~25 min, nearly all of it the three range-requested slices (~140 MB).
# Usage:    bash build_sv_contact_maps.sh [outdir]
#
# Deploy the result. The config is deployed FROM its checked-in copy, and the
# data files have no repo copy at all:
#   scripts/deploy-demo.sh sv_contact_maps/config.json
#   for f in <outdir>/deploy/*; do
#     DEPLOY_DEMO_ALLOW_UNTRACKED=1 scripts/deploy-demo.sh \
#       "$f" "sv_contact_maps/$(basename "$f")"
#   done
set -euo pipefail

# Absolute path to this script's dir, captured before we cd elsewhere, so the
# sibling sv_contact_maps.py resolves no matter where the script is run from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Sibling helpers this script runs, fetched next to it when absent, so a bare
# `curl -fO` of this one file behaves the same as a repo checkout.
HELPERS=(sv_contact_maps.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUTDIR="${1:-sv_contact_maps_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

DEPLOY=deploy
mkdir -p "$DEPLOY"

# ── Pinned inputs ───────────────────────────────────────────────────────────
GIAB=https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data/NA12878
BAM_URL=$GIAB/NIST_NA12878_HG001_HiSeq_300x/NHGRI_Illumina300X_novoalign_bams/HG001.hs37d5.300x.bam
KG=https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/phase3/integrated_sv_map
SV_VCF_URL=$KG/ALL.wgs.mergedSV.v8.20130502.svs.genotypes.vcf.gz

BAM=$DEPLOY/NA12878.sv_contact_maps.bam
SV_VCF=$DEPLOY/NA12878.1000g_sv.vcf.gz

# In header order (5 before 7 before 17), because `samtools view` writes the
# regions in the order given and a BAM whose records run out of header order
# cannot be indexed.
REGIONS=(5:175240000-175480000 7:70300000-70560000 17:16560000-16800000)

# ── The reads: three range-requested slices in one pass ─────────────────────
if [ ! -f "$BAM" ]; then
  samtools view -b -o "$BAM" "$BAM_URL" "${REGIONS[@]}"
fi
[ -f "$BAM.bai" ] || samtools index "$BAM"

# ── The four channels ───────────────────────────────────────────────────────
# One .hic per channel, each covering all three loci, so the demo carries four
# contact tracks rather than four per variant.
#
# --min-span 1000 is what "discordant" means here: the p99 insert of this
# library is 849 bp, so a pair whose ends are a kilobase apart is not a long
# fragment.
# --bin 750 is Cue's bin, and 750 has to be among --resolutions because the
# depth channel writes one record per bin pair.
# The helper fetches juicer_tools into its own --out, so that is a work
# directory and the four .hic files are copied across from it.
#
# The rerun guard is on the WORK dir, and the copy then runs every time. It used
# to guard the pair on `$DEPLOY/depth_difference.hic` and copy the four names in
# one `cp`, which cannot survive the empty channel this script is built to
# produce: `cp` skips a missing source, copies the rest — `depth_difference.hic`
# among them, it is last — and exits 1, so `set -e` aborted with the guard file
# already in place and the next run skipped the block. A deploy dir permanently
# short one channel, reported as success.
if [ ! -f hic/depth_difference.hic ]; then
  python3 "$SCRIPT_DIR/sv_contact_maps.py" "$BAM" \
    --out hic \
    --min-span 1000 \
    --bin 750 \
    --resolutions 750,1500,5000,25000
fi
# A channel with no contacts writes no .hic (juicer `pre` exits 57 on an empty
# matrix), so a missing name here is expected rather than a failure.
for channel in discordant same_strand outward depth_difference; do
  if [ -f "hic/$channel.hic" ]; then
    cp "hic/$channel.hic" "$DEPLOY"/
  fi
done

# ── The calls: NA12878's own non-reference SVs out of the 1000G phase 3 map ──
# `-c 1` after `-s` drops every site NA12878 is homozygous reference at, leaving
# 3,260 of the callset's 68,818.
if [ ! -f "$SV_VCF" ]; then
  bcftools view -s NA12878 -c 1 -Oz -o "$SV_VCF" "$SV_VCF_URL"
fi
tabix -f -p vcf "$SV_VCF"

echo
echo "Built $(cd "$DEPLOY" && pwd):"
ls -la "$DEPLOY"
echo
echo "Read the counts back per channel with juicer_tools dump, e.g. the"
echo "inversion's same-strand contacts:"
echo "  java -jar hic/juicer_tools_1.22.01.jar dump observed NONE \\"
echo "    $DEPLOY/same_strand.hic 7 7 BP 750 /dev/stdout | sort -k3,3rn | head"
