#!/usr/bin/env bash
#
# Build the companion haplotype index for HPRC release 2.1's gbz-base database,
# the file GbzBaseSyntenyAdapter needs to name the walks it reads.
#
# HPRC publishes the database itself (10 GB, range-requestable), so nothing here
# constructs one. What it does not publish is haplotype names: upstream gbz-base
# reports `unknown#1`, `unknown#2` for the walks in a subgraph, because the
# database stores no map from a GBWT position back to a sample. gbz-haplotype-index
# walks the GBZ and writes that map as two side tables. --output puts them in a
# standalone file rather than into the database, which is the only form available
# for a database somebody else hosts.
#
# Requires: cargo (Rust), curl, git. Measured on the release 2.1 GRCh38 graph
# with 24 threads on a Linux box: 13 s to load the GBZ, 4 s to choose the
# anchors, 11 minutes of walking, 7 s to sort the 178.5M recorded positions
# and 95 s to write them, for a 7.9 GB companion. The sort holds every position
# in memory, so give it room. The 5.5 GB download is one-time and resumable.
# On a 16-thread Intel Mac (macOS 15) the walk aborted inside libmalloc's nano
# zone; MallocNanoZone=0 or --threads 8 got past it, at over an hour of walking.
#
# Usage: bash scripts/build_hprc_gbz_index.sh [out-dir]
#
# Produces <out-dir>/hprc-v2.1-mc-grch38.haplotype-index.anchored.db.
set -euo pipefail

OUT="${1:-hprc_gbz_index_build}"
mkdir -p "$OUT"
cd "$OUT"

BASE=https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38
GBZ=hprc-v2.1-mc-grch38.gbz

# -C resumes a partial download rather than restarting 5.5 GB.
if [ ! -s "$GBZ" ]; then
  curl -fL -C - -o "$GBZ" "$BASE/$GBZ"
fi

# The tool ships in the reader package's repo rather than on crates.io, and is
# built on the unmodified upstream gbz/gbwt crates.
if [ ! -d gbz-base-js ]; then
  git clone --depth 1 https://github.com/GMOD/gbz-base-js.git
fi
cargo build --release --manifest-path gbz-base-js/tools/haplotype-index/Cargo.toml

# --interval is the bp spacing of the recorded GBWT positions. 16384 gives 159M
# positions over this graph's 53,150 paths; at 65536 it is a quarter the size
# and a haplotype walks up to four times further to be identified.
# --anchor-spacing is the bp spacing of the anchors along GRCh38 and CHM13, the
# node most haplotypes pass in the half spacing before each multiple, with every
# haplotype's visit through it recorded; a window for a chosen set of lanes
# walks those haplotypes from the anchor before it. 131072 over the 292
# reference paths is 45,557 anchors.
gbz-base-js/tools/haplotype-index/target/release/gbz-haplotype-index \
  --interval 16384 \
  --anchor-spacing 131072 \
  --output hprc-v2.1-mc-grch38.haplotype-index.anchored.db \
  "$GBZ"

echo "wrote $OUT/hprc-v2.1-mc-grch38.haplotype-index.anchored.db"
