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
# group in. A run of odp over any two genomes writes the same columns under
# odp/step2-figures/synteny_coloredby_BCnSSimakov2022/ (synteny_analysis/ and
# BCnS_LGs in the older odp that made the deposit), so the JBrowse half below
# works unchanged on your own species.
#
# Requires: python3, samtools, curl, tar, awk, gzip, and node
#           (JBrowse CLI, via npx unless `jbrowse` is on PATH).
# Usage:    DRYAD_DIR=~/Downloads bash scripts/build_odp_linkage_groups_synteny.sh [outdir]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for tool in curl tar awk gzip samtools python3 node; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

HELPERS=(rbh_to_blocks.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || { curl -fsSL -o "$SCRIPT_DIR/$h.part" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h" && mv "$SCRIPT_DIR/$h.part" "$SCRIPT_DIR/$h"; }
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

# Species table: odp code, its directory in genomes.tar.gz, display name
SPECIES='
RES rhopilema_li Rhopilema (jellyfish)
EMU ephydatia Ephydatia (sponge)
HCA hormiphora Hormiphora (comb jelly)
BIN bolinopsis Bolinopsis (comb jelly)
BFL branchiostoma Branchiostoma (amphioxus)
CLAa cladorhizid_v0.6_hapA Cladorhizid (sponge)
'
# The pairs to load: the jellyfish against the sponge for the dotplot, then the
# neighbours of the six-genome stack in the order of the paper's figure 1d
# (comb jellies, jellyfish, amphioxus, sponges)
PAIRS='
RES EMU
BIN HCA
RES HCA
RES BFL
BFL EMU
EMU CLAa
'
# GNU tar matches an include pattern literally unless --wildcards precedes it;
# the bsdtar macOS ships globs by default and exits on the flag.
WILDCARDS=
case "$(tar --version 2>&1)" in *'GNU tar'*) WILDCARDS=--wildcards ;; esac

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

while read -r code dir _; do
  [ -z "$code" ] && continue
  d="genomes/$dir"
  fa=$(ls "$d"/*.fasta | awk 'NR<=1')
  [ -f "$code.fa" ] || ln -sf "$fa" "$code.fa"
  [ -f "$code.fa.fai" ] || samtools faidx "$code.fa"
  [ -f "$code.chrom" ] || ln -sf "$(ls "$d"/*.chrom | awk 'NR<=1')" "$code.chrom"
done <<<"$SPECIES"

# One .blocks per pair, the gene_group, color and break_FET columns carried
# through: break_FET is odp's Fisher's exact test of the row's chromosome pair,
# which the stack's opacity reads. The .chrom files give each gene its real
# interval; _pos alone would be one base.
mkdir -p blocks
while read -r a b; do
  [ -z "$a" ] && continue
  pair="${a}_${b}"
  [ -s "blocks/$pair.blocks" ] || python3 "$SCRIPT_DIR/rbh_to_blocks.py" \
    "tables/$(table_of "$a" "$b")" -o "blocks/$pair.blocks" --bed-dir "blocks/$pair" \
    --species "$a" "$b" --chrom "$a=$a.chrom" "$b=$b.chrom" \
    --attributes gene_group color break_FET
done <<<"$PAIRS"

if [ -n "${JBROWSE_CLI:-}" ]; then
  jb() { $JBROWSE_CLI "$@"; }
elif [[ "$(jbrowse --version 2>/dev/null)" == *"version "[5-9].* ]]; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli@next "$@"; }
fi
APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP" --branch main
while read -r code _ name; do
  [ -z "$code" ] && continue
  jb add-assembly "$code.fa" --name "$code" --displayName "$name" \
    --load copy --force --out "$APP"
done <<<"$SPECIES"

while read -r a b; do
  [ -z "$a" ] && continue
  pair="${a}_${b}"
  cp "blocks/$pair.blocks" "$APP/"
  cp -r "blocks/$pair" "$APP/"
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
        'uri': f'{pair}.blocks',
        'blockAssemblies': [a, b],
        'bedLocations': [f'{pair}/{a}.bed', f'{pair}/{b}.bed'],
        # the label column and the color odp put beside it, what
        # Color by -> gene_group paints, and the pair's test, what the
        # stack's opacity reads
        'attributeColumns': ['gene_group', 'color', 'break_FET'],
    },
}, indent=2))
PY
  jb add-track-json "$pair.track.json" --update --out "$APP"
done <<<"$PAIRS"

# The tutorial's two views. In the dotplot, autoDiagonalize sorts the sponge
# chromosomes by where their orthologs land on the jellyfish, which turns one
# block per linkage group into a diagonal, and EMU* keeps the sponge's unplaced
# scaffolds, a fifth of its axis, off it. The stack sorts outward from the
# jellyfish row, draws only labelled orthologs, and fades those off a
# significantly paired chromosome pair by break_FET.
cat > session.json <<'JSON'
{
  "name": "Ancestral linkage groups",
  "views": [
    {
      "type": "DotplotView",
      "displayName": "Rhopilema (jellyfish) vs Ephydatia (sponge)",
      "views": [
        { "assembly": "RES" },
        { "assembly": "EMU", "displayedRegionNames": ["EMU*"] }
      ],
      "tracks": ["RES_EMU"],
      "encoding": { "color": "gene_group" },
      "autoDiagonalize": true,
      "lineWidth": 4,
      "height": 860
    },
    {
      "type": "LinearSyntenyView",
      "displayName": "Comb jellies, jellyfish, amphioxus, sponges",
      "views": [
        { "assembly": "BIN", "displayedRegionNames": ["BIN*"] },
        { "assembly": "HCA", "displayedRegionNames": ["HCA*"] },
        { "assembly": "RES", "displayedRegionNames": ["RES*"] },
        { "assembly": "BFL", "displayedRegionNames": ["BFL*"] },
        { "assembly": "EMU", "displayedRegionNames": ["EMU*"] },
        { "assembly": "CLAa", "displayedRegionNames": ["CLA*_hapA"] }
      ],
      "tracks": [
        ["BIN_HCA"],
        ["RES_HCA"],
        ["RES_BFL"],
        ["BFL_EMU"],
        ["EMU_CLAa"]
      ],
      "encoding": {
        "color": "gene_group",
        "opacity": {
          "field": "break_FET",
          "scale": {
            "type": "threshold",
            "domain": [0.05],
            "range": [0.8, 0.15]
          }
        }
      },
      "filter": [{ "field": "gene_group", "valid": true }],
      "autoDiagonalize": true,
      "diagonalizeAnchorRow": 2,
      "mark": { "interpolate": "bump" },
      "render": { "antialias": false },
      "levelHeights": [130, 130, 130, 130, 130],
      "collapseEmptyRows": true
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json with every assembly above, one ortholog table per"
echo "species pair carrying its linkage groups, and a default session with the"
echo "dotplot and the six-genome stack colored by them. Serve it and open in a"
echo "browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
