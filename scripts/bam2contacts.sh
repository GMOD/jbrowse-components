#!/usr/bin/env bash
# bam2contacts.sh — turn read pairs from a coordinate-sorted BAM into a sorted
# Juicer "short format" contact list (one line per read pair):
#   <str1> <chr1> <pos1> <frag1> <str2> <chr2> <pos2> <frag2>
# frag columns are dummies (0/1): we bin by fixed resolution, not by
# restriction fragment. Output is ordered the way `juicer_tools pre` wants —
# by chromosome index (from the .sizes file, NOT lexical), then position.
#
# Used by build_readpair_heatmap_cgiab.sh; see
# website/docs/tutorials/readpair_heatmap.md.
#
# Usage: bam2contacts.sh <in.bam> <mode> <chrom.sizes> > contacts.txt
#   mode = all         every confidently-mapped pair (diagonal + SV signal)
#          discordant  only pairs flagged abnormal (large insert / wrong
#                       orientation / inter-chromosomal) — the SV-informative set
set -euo pipefail
BAM=$1
MODE=${2:-all}
SIZES=$3
MIN_MAPQ=${MIN_MAPQ:-20}
MAX_NORMAL_TLEN=${MAX_NORMAL_TLEN:-1000}

# -f 65   keep paired (0x1) first-in-pair (0x40) reads  -> one record per pair
# -F 2316 drop unmapped (0x4) / mate-unmapped (0x8) / secondary (0x100) /
#         supplementary (0x800) -> both ends mapped, primary only
samtools view -q "$MIN_MAPQ" -f 65 -F 2316 "$BAM" \
  | awk -v mode="$MODE" -v maxtlen="$MAX_NORMAL_TLEN" -v sizes="$SIZES" '
    BEGIN {
      i = 0
      while ((getline line < sizes) > 0) { split(line, a, "\t"); idx[a[1]] = i++ }
    }
    {
      flag = $2
      chr1 = $3;                       pos1 = $4
      chr2 = ($7 == "=") ? $3 : $7;    pos2 = $8
      if (!(chr1 in idx) || !(chr2 in idx)) next
      str1 = and(flag,16) ? 1 : 0
      str2 = and(flag,32) ? 1 : 0
      tlen = $9; if (tlen < 0) tlen = -tlen

      if (mode == "discordant") {
        interchrom = (chr1 != chr2)
        sameStrand = (str1 == str2)                  # FF / RR (inversion)
        bigInsert  = (chr1 == chr2 && tlen > maxtlen)
        if (!(interchrom || sameStrand || bigInsert)) next
      }

      # upper-triangular: lower chromosome index first, then lower position.
      # prepend numeric sort keys (idx1 idx2), stripped after the sort.
      i1 = idx[chr1]; i2 = idx[chr2]
      if (i1 < i2 || (i1 == i2 && pos1 <= pos2))
        print i1, i2, str1, chr1, pos1, 0, str2, chr2, pos2, 1
      else
        print i2, i1, str2, chr2, pos2, 0, str1, chr1, pos1, 1
    }' \
  | sort -k1,1n -k2,2n -k5,5n -k9,9n -S2G \
  | cut -d' ' -f3-
