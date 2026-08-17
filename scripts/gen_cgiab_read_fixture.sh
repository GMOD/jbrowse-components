#!/bin/bash
#
# Emits the READS array of
# plugins/alignments/src/features/derivativePaths/realReads.cgiab.test.ts:
# every split read (SA tag, primary-ish) the hosted HG008 demo slice holds over
# the two windows that fixture's REGIONS name.
#
# The fixture used to be hand-maintained, which made it unclear whether a record
# was missing because the data lacks it or because the slice was cut too narrow
# -- and the slice WAS cut too narrow (see build_demo_slices.sh). Regenerating
# it is now one command, so the answer is checkable.
#
# Records sort by name then reference, which is the order the committed fixture
# is in; samtools' own order is by region, so it puts chr3 first.
#
# Usage: bash scripts/gen_cgiab_read_fixture.sh [bam] > READS.ts.part
set -euo pipefail

BAM="${1:-https://jbrowse.org/demos/cgiab/HG008-T_PacBio-HiFi-Revio_116x.demo_slices.bam}"

# Must match REGIONS in the test file.
REGIONS=(chr3:139936789-139986329 chr13:114317474-114353942)

samtools view -F 1540 "$BAM" "${REGIONS[@]}" |
  awk -F'\t' '
    {
      sa = ""
      for (i = 12; i <= NF; i++) if ($i ~ /^SA:Z:/) { sa = substr($i, 6); break }
      if (sa == "") next
      strand = and($2, 16) ? -1 : 1
      printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\n", $1, $3, $2, strand, $4, $6, sa
    }
  ' |
  sort -t$'\t' -k1,1 -k2,2 -k5,5n |
  awk -F'\t' '
    BEGIN { print "const READS: Rec[] = [" }
    {
      printf "  {\n"
      printf "    name: %c%s%c,\n", 39, $1, 39
      printf "    flag: %s,\n", $3
      printf "    strand: %s,\n", $4
      printf "    ref: %c%s%c,\n", 39, $2, 39
      printf "    pos: %s,\n", $5
      printf "    CIGAR: %c%s%c,\n", 39, $6, 39
      printf "    SA: %c%s%c,\n", 39, $7, 39
      printf "  },\n"
    }
    END { print "]" }
  '
