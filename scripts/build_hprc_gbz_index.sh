#!/usr/bin/env bash
#
# Build the companion haplotype index for HPRC release 2.1's gbz-base database,
# the file GbzBaseSyntenyAdapter needs to name the walks it reads.
#
# HPRC publishes the database itself (10 GB, range-requestable), so nothing here
# constructs one. What it does not publish is haplotype names: upstream gbz-base
# reports `unknown#1`, `unknown#2` for the walks in a subgraph, because the
# database stores no map from a GBWT position back to a sample.
# gbz-haplotype-index walks the GBZ and writes that map to a companion file,
# with the stray rows and the whole-chromosome overview beside it.
#
# Requires: cargo (Rust) and curl. Measured on the release 2.1 GRCh38 graph with
# 22 threads on a Linux box with 125 GB of memory: 35 minutes, of which 7 walk
# the paths, 12 write the stray rows, 9 the overview and 6 the file, for a
# 5.1 GB index (0.47 GB of it the overview). The 5.5 GB GBZ and 10 GB database
# downloads are one-time and resumable. On a 16-thread Intel Mac (macOS 15) the
# walk aborted inside libmalloc's nano zone; MallocNanoZone=0 or --threads 8 got
# past it.
#
# Usage: bash scripts/build_hprc_gbz_index.sh [out-dir]
#
# Produces <out-dir>/hprc-v2.1-mc-grch38.haplotype-index.f3.db, a format 3
# index, the one format @gmod/gbz-base 7 reads.
set -euo pipefail

OUT="${1:-hprc_gbz_index_build}"
mkdir -p "$OUT"
cd "$OUT"

BASE=https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38
GBZ=hprc-v2.1-mc-grch38.gbz
INDEX=hprc-v2.1-mc-grch38.haplotype-index.f3.db

# -C resumes a partial download rather than restarting it.
for file in "$GBZ" "$GBZ.db"; do
  if [ ! -s "$file" ]; then
    curl -fL -C - -o "$file" "$BASE/$file"
  fi
done

cargo install --locked gbz-haplotype-index --version 0.3.0

# --interval is the bp spacing of the recorded GBWT positions. 16384 gives 159M
# positions over this graph's 53,150 paths; at 65536 it is a quarter the size
# and a haplotype walks up to four times further to be identified.
# --anchor-spacing is the bp spacing of the anchors along GRCh38 and CHM13, the
# node most haplotypes pass in the half spacing before each multiple, with every
# haplotype's visit through it recorded; a window for a chosen set of lanes
# walks those haplotypes from the anchor before it. 131072 over the 292
# reference paths is 45,557 anchors.
# The database beside the GBZ is checked against it and supplies the top-level
# snarls the stray rows need. The stray and overview options keep their
# defaults: 4096 bp overview bins at 5 levels.
gbz-haplotype-index \
  --interval 16384 \
  --anchor-spacing 131072 \
  "$GBZ" "$GBZ.db" "$INDEX"

echo "wrote $OUT/$INDEX"
