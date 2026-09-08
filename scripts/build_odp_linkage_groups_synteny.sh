#!/usr/bin/env bash
#
# Reproducibly build the ancestral-linkage-group synteny views shown in
# website/docs/tutorials/odp_linkage_groups_synteny.md, then wire up a runnable
# JBrowse.
#
# The genomes and the ortholog tables are the Dryad deposit behind Schultz et
# al. 2023 (10.5061/dryad.dncjsxm47, CC0). Dryad serves its files only to a
# browser, so the two tarballs are downloaded by hand into $DRYAD_DIR (default
# ~/Downloads) and this script extracts just what it needs.
#
# The tables are the ones odp plotted for the paper: one per species pair, every
# reciprocal best hit between the two proteomes, each row carrying the BCnS
# linkage group odp's HMM search assigned it and the color the paper draws that
# group in. A run of odp over any two genomes writes the same files under
# synteny_analysis/step2-figures/synteny_coloredby_BCnS_LGs/, so the JBrowse
# half below works unchanged on your own species.
#
# Requires: python3, samtools, curl, tar, and node
#           (JBrowse CLI, via npx unless `jbrowse` is on PATH).
# Usage:    DRYAD_DIR=~/Downloads bash scripts/build_odp_linkage_groups_synteny.sh [outdir]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(rbh_to_blocks.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUTDIR="${1:-odp_linkage_groups_build}"
DRYAD_DIR="${DRYAD_DIR:-$HOME/Downloads}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

for f in genomes.tar.gz supplementary_information.tar.gz; do
  [ -f "$DRYAD_DIR/$f" ] || {
    echo "$DRYAD_DIR/$f is missing: download it from" >&2
    echo "https://datadryad.org/dataset/doi:10.5061/dryad.dncjsxm47" >&2
    exit 1
  }
done

# Species table: odp three-letter code and its directory in genomes.tar.gz.
# The first row is the anchor every dotplot puts on its horizontal axis.
SPECIES='
RES rhopilema_li
EMU ephydatia
HCA hormiphora
COW capsaspora/capsasporaA
BIN bolinopsis
BFL branchiostoma
CLAa cladorhizid_v0.6_hapA
'
# The pairs to load: the jellyfish against each of the three genomes the
# dotplots compare it with, then the neighbours of the six-genome stack, which
# is the order of the paper's figure 1d (comb jellies, jellyfish, amphioxus,
# sponges).
PAIRS='
RES EMU
RES HCA
RES COW
BIN HCA
RES BFL
BFL EMU
EMU CLAa
'
# GNU tar matches an include pattern literally unless --wildcards precedes it;
# the bsdtar macOS ships globs by default and exits on the flag.
WILDCARDS=
case "$(tar --version 2>&1)" in *'GNU tar'*) WILDCARDS=--wildcards ;; esac

CODES=()
while IFS= read -r line; do CODES+=("$line"); done < <(awk 'NF {print $1}' <<<"$SPECIES")

if [ ! -d genomes ]; then
  DIRS=()
  while IFS= read -r line; do DIRS+=("$line"); done \
    < <(awk 'NF {print "*/for_odp/" $2 "/*"}' <<<"$SPECIES")
  tar xzf "$DRYAD_DIR/genomes.tar.gz" $WILDCARDS "${DIRS[@]}"
  # the archive's own root is `genomes/`, so for_odp is lifted out from under
  # whatever it landed in rather than moved onto its own parent
  extracted=$(find . -type d -name for_odp | awk 'NR<=1')
  [ -n "$extracted" ] || {
    echo "genomes.tar.gz extracted no for_odp directory" >&2
    exit 1
  }
  mv "$extracted" for_odp_lifted
  rm -rf genomes
  mv for_odp_lifted genomes
fi

# odp names a pair's files with the two codes in alphabetical order
table_of() {
  local a=$1 b=$2
  [[ "$a" < "$b" ]] || { local t=$a; a=$b; b=$t; }
  echo "${a}_${b}_xy_reciprocal_best_hits.coloredby_BCnS_LGs.plotted.rbh"
}
if [ ! -d tables ]; then
  PATTERNS=()
  while read -r a b; do
    [ -z "$a" ] && continue
    PATTERNS+=("*/synteny_coloredby_BCnS_LGs/$(table_of "$a" "$b")")
  done <<<"$PAIRS"
  tar xzf "$DRYAD_DIR/supplementary_information.tar.gz" $WILDCARDS "${PATTERNS[@]}"
  mkdir -p tables
  find . -path ./tables -prune -o -name '*.plotted.rbh' -print \
    | while read -r f; do mv "$f" tables/; done
  rm -rf supplementary_information
fi

# Ephydatia is not redistributed in the tarball. Its directory holds odp's own
# fetch script, which renames the scaffolds with `sed -s` - a GNU flag the BSD
# sed macOS ships rejects, leaving a zero-byte FASTA that only fails later at
# faidx. The fetch and the same 25 substitutions are repeated here portably.
EMU_DIR=genomes/ephydatia
if [ ! -s "$EMU_DIR/EMU.fasta" ]; then
  curl -fsSL -o "$EMU_DIR/Emu_genome_v1.fa.gz" \
    https://bitbucket.org/EphydatiaGenome/ephydatiagenome/downloads/Emu_genome_v1.fa.gz
  i=1
  while [ "$i" -le 25 ]; do
    printf 's/scaffold_%04d/EMU%d/g\n' "$i" "$i"
    i=$((i + 1))
  done > "$EMU_DIR/rename.sed"
  gzip -dc "$EMU_DIR/Emu_genome_v1.fa.gz" \
    | sed -f "$EMU_DIR/rename.sed" > "$EMU_DIR/EMU.fasta"
  rm -f "$EMU_DIR/Emu_genome_v1.fa.gz" "$EMU_DIR/rename.sed"
fi

while read -r code dir; do
  [ -z "$code" ] && continue
  d="genomes/$dir"
  fa=$(ls "$d"/*.fasta | awk 'NR<=1')
  [ -f "$code.fa" ] || ln -sf "$fa" "$code.fa"
  [ -f "$code.fa.fai" ] || samtools faidx "$code.fa"
  [ -f "$code.chrom" ] || ln -sf "$(ls "$d"/*.chrom | awk 'NR<=1')" "$code.chrom"
done <<<"$SPECIES"

# One .blocks per pair, the gene_group and color columns carried through. The
# .chrom files give each gene its real interval; _pos alone would be one base.
mkdir -p blocks
while read -r a b; do
  [ -z "$a" ] && continue
  pair="${a}_${b}"
  [ -s "blocks/$pair.blocks" ] || python3 "$SCRIPT_DIR/rbh_to_blocks.py" \
    "tables/$(table_of "$a" "$b")" -o "blocks/$pair.blocks" --bed-dir "blocks/$pair" \
    --species "$a" "$b" --chrom "$a=$a.chrom" "$b=$b.chrom"
  gzip -kf "blocks/$pair.blocks"
  gzip -kf "blocks/$pair/$a.bed" "blocks/$pair/$b.bed"
done <<<"$PAIRS"

if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi
APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP"
for code in "${CODES[@]}"; do
  jb add-assembly "$code.fa" --name "$code" --load copy --force --out "$APP"
done

while read -r a b; do
  [ -z "$a" ] && continue
  pair="${a}_${b}"
  cp "blocks/$pair.blocks.gz" "$APP/$pair.blocks.gz"
  cp "blocks/$pair/$a.bed.gz" "$APP/$pair.$a.bed.gz"
  cp "blocks/$pair/$b.bed.gz" "$APP/$pair.$b.bed.gz"
  python3 - "$a" "$b" > "$pair.track.json" <<'PY'
import json, sys
a, b = sys.argv[1:3]
pair = f"{a}_{b}"
print(json.dumps({
    'type': 'SyntenyTrack',
    'trackId': pair,
    'name': f'{a} vs {b} orthologs, colored by BCnS linkage group',
    'assemblyNames': [a, b],
    'adapter': {
        'type': 'MCScanBlocksAdapter',
        'uri': f'{pair}.blocks.gz',
        'blockAssemblies': [a, b],
        'bedLocations': [{'uri': f'{pair}.{a}.bed.gz'}, {'uri': f'{pair}.{b}.bed.gz'}],
        'assemblyNames': [a, b],
        # the label column and the color odp put beside it: what
        # Color by -> gene_group paints
        'attributeColumns': ['gene_group', 'color'],
    },
}, indent=2))
PY
  jb add-track-json "$pair.track.json" --update --out "$APP"
done <<<"$PAIRS"

# autoDiagonalize sorts the sponge chromosomes by where their orthologs land on
# the jellyfish, which is what turns one block per linkage group into a
# diagonal. Only the chromosomes with orthologs are drawn: the sponge's
# unplaced scaffolds would otherwise take a fifth of the axis.
cat > session.json <<'JSON'
{
  "name": "Ancestral linkage groups: Rhopilema vs Ephydatia",
  "views": [
    {
      "type": "DotplotView",
      "displayName": "Rhopilema (jellyfish) vs Ephydatia (sponge)",
      "views": [
        { "assembly": "RES" },
        { "assembly": "EMU", "displayedRegionNames": ["EMU*"] }
      ],
      "tracks": ["RES_EMU"],
      "colorBy": "attribute:gene_group",
      "autoDiagonalize": true,
      "lineWidth": 3,
      "height": 940
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json with every assembly above, one ortholog table per"
echo "species pair carrying its linkage groups, and a default dotplot session"
echo "colored by them. Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
