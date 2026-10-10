#!/usr/bin/env bash
#
# The allele inventory is `gfa-to-tabix alleles <prefix>` from gfa-to-tabix
# 0.7.0 on: https://github.com/GMOD/gfa-to-tabix#alleles. This stub keeps the
# old name working for the scripts and urls that still call it.
#
# Requires: gfa-to-tabix 0.7.0 or later (`cargo install gfa-to-tabix`)
# Usage:    bash scripts/build_rgfa_alleles.sh <prefix>
#
# Reads <prefix>.segs.bed.gz and <prefix>.links.bed.gz from gfa-to-tabix
# --layout contig and writes <prefix>.alleles.bed.gz{,.tbi}.
set -euo pipefail

PREFIX="${1:?usage: build_rgfa_alleles.sh <prefix>}"
command -v gfa-to-tabix > /dev/null ||
  { echo "needs gfa-to-tabix 0.7.0 or later: cargo install gfa-to-tabix" >&2; exit 1; }
exec gfa-to-tabix alleles "$PREFIX"
