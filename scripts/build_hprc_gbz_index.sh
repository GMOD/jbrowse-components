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
# with 14 threads: 28 s to load the GBZ, 71 minutes of walking, 11 s to sort the
# 158.7M recorded positions and 166 s to write them. The sort holds every
# position in memory, so give it room. The 5.5 GB download is one-time and
# resumable.
#
# Usage: bash scripts/build_hprc_gbz_index.sh [out-dir]
#
# Produces <out-dir>/hprc-v2.1-mc-grch38.haplotype-index.db.
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
# positions over this graph's 53,150 paths and a 7.0 GB companion; at 65536 it
# is a quarter the size and a haplotype walks up to four times further to be
# identified.
gbz-base-js/tools/haplotype-index/target/release/gbz-haplotype-index \
  --interval 16384 \
  --output hprc-v2.1-mc-grch38.haplotype-index.db \
  "$GBZ"

echo "wrote $OUT/hprc-v2.1-mc-grch38.haplotype-index.db"
