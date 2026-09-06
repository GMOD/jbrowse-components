#!/usr/bin/env bash
#
# Reproducibly build the ancestral-linkage-group synteny views shown in
# website/docs/tutorials/odp_linkage_groups_synteny.md, then wire up a runnable
# JBrowse.
#
# The genomes and the four-way ortholog table are the Dryad deposit behind
# Schultz et al. 2023 (10.5061/dryad.dncjsxm47, CC0). Dryad serves its files
# only to a browser, so the two tarballs are downloaded by hand into
# $DRYAD_DIR (default ~/Downloads) and this script extracts just what it needs.
# The ancestral linkage groups themselves, with the paper's colors, are the
# BCnS table odp ships (Simakov et al. 2022), fetched from GitHub.
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

# Species table: odp three-letter code, its directory in genomes.tar.gz, and
# the code the four-way table uses for it (the paper's RES is the Li et al.
# annotation, which its tables spell RESLi). The first row is the anchor.
SPECIES='
RES rhopilema_li           RESLi
EMU ephydatia              EMU
HCA hormiphora             HCA
COW capsaspora/capsasporaA COW
'
# GNU tar matches an include pattern literally unless --wildcards precedes it;
# the bsdtar macOS ships globs by default and exits on the flag.
WILDCARDS=
case "$(tar --version 2>&1)" in *'GNU tar'*) WILDCARDS=--wildcards ;; esac

names_of() { awk 'NF {print $1}' <<<"$SPECIES"; }
CODES=()
while IFS= read -r line; do CODES+=("$line"); done < <(names_of)

FOURWAY=COW_EMU_HCA_RESLi_reciprocal_best_hits.rbh
if [ ! -d genomes ]; then
  DIRS=()
  while IFS= read -r line; do DIRS+=("$line"); done \
    < <(awk 'NF {print "*/for_odp/" $2 "/*"}' <<<"$SPECIES")
  tar xzf "$DRYAD_DIR/genomes.tar.gz" $WILDCARDS "${DIRS[@]}"
  # the archive's own root is `genomes/`, so for_odp is lifted out from under
  # whatever it landed in rather than moved onto its own parent
  extracted=$(find . -type d -name for_odp | head -1)
  [ -n "$extracted" ] || {
    echo "genomes.tar.gz extracted no for_odp directory" >&2
    exit 1
  }
  mv "$extracted" for_odp_lifted
  rm -rf genomes
  mv for_odp_lifted genomes
fi
if [ ! -f "$FOURWAY" ]; then
  tar xzf "$DRYAD_DIR/supplementary_information.tar.gz" $WILDCARDS "*/$FOURWAY"
  find . -name "$FOURWAY" -not -path "./$FOURWAY" -exec mv {} . \;
fi
if [ ! -f BCnSSimakov2022.rbh ]; then
  curl -fsSL -o bcns.tar.gz \
    https://raw.githubusercontent.com/conchoecia/odp/main/LG_db/BCnSSimakov2022.tar.gz
  tar xzf bcns.tar.gz BCnSSimakov2022/BCnSSimakov2022.rbh
  mv BCnSSimakov2022/BCnSSimakov2022.rbh .
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
  fa=$(ls "$d"/*.fasta | head -1)
  [ -f "$code.fa" ] || ln -sf "$fa" "$code.fa"
  [ -f "$code.fa.fai" ] || samtools faidx "$code.fa"
  [ -f "$code.chrom" ] || ln -sf "$(ls "$d"/*.chrom | head -1)" "$code.chrom"
done <<<"$SPECIES"

# The four-way table has no linkage-group column, so the BCnS table's is joined
# on the Rhopilema gene ids the two share. The .chrom files give each gene its
# real interval; _pos alone would be one base.
if [ ! -f alg.blocks ]; then
  CHROMS=()
  while IFS= read -r line; do CHROMS+=("$line"); done \
    < <(awk 'NF {print $3 "=" $1 ".chrom"}' <<<"$SPECIES")
  TABLE_CODES=()
  while IFS= read -r line; do TABLE_CODES+=("$line"); done \
    < <(awk 'NF {print $3}' <<<"$SPECIES")
  python3 "$SCRIPT_DIR/rbh_to_blocks.py" "$FOURWAY" -o alg.blocks --bed-dir beds \
    --species "${TABLE_CODES[@]}" --chrom "${CHROMS[@]}" \
    --alg BCnSSimakov2022.rbh --alg-species RESLi=RES
  for i in "${!CODES[@]}"; do
    mv "beds/${TABLE_CODES[$i]}.bed" "beds/${CODES[$i]}.bed"
  done
fi
gzip -kf alg.blocks
for code in "${CODES[@]}"; do
  gzip -kf "beds/$code.bed"
done

if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi
APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP"
cp alg.blocks.gz "$APP"/
for code in "${CODES[@]}"; do
  cp "beds/$code.bed.gz" "$APP/$code.bed.gz"
  jb add-assembly "$code.fa" --name "$code" --load copy --force --out "$APP"
done

python3 - "${CODES[*]}" > blocks_track.json <<'PY'
import json, sys
names = sys.argv[1].split()
print(json.dumps({
    'type': 'SyntenyTrack',
    'trackId': 'alg_blocks',
    'name': 'Orthologs by ancestral linkage group (BCnS)',
    'assemblyNames': names,
    'adapter': {
        'type': 'MCScanBlocksAdapter',
        'uri': 'alg.blocks.gz',
        'blockAssemblies': names,
        'bedLocations': [{'uri': '%s.bed.gz' % n} for n in names],
        'assemblyNames': names,
        # the label column and the color odp put beside it: what
        # Color by -> gene_group paints
        'attributeColumns': ['gene_group', 'color'],
    },
    # the lane stack reads the same column. Its ribbonColor default is a
    # translucent grey, so an ortholog BCnS assigns no group to recedes
    # instead of taking the synteny view's match red.
    'displays': [
        {
            'type': 'MultiWaySyntenyDisplay',
            'displayId': 'alg_blocks-MultiWaySyntenyDisplay',
            'ribbonColorBy': 'attribute:gene_group',
        },
    ],
}, indent=2))
PY
jb add-track-json blocks_track.json --update --out "$APP"

# A dotplot rather than the stacked synteny view: at whole-genome scale a lane
# stack draws every ortholog as a chord across the whole width, and the ~59% the
# BCnS table assigns no group to paint the synteny view's missing-data red over
# the rest. On two axes the same rows separate into one block per linkage group.
cat > session.json <<'JSON'
{
  "name": "Ancestral linkage groups: Rhopilema vs Ephydatia",
  "views": [
    {
      "type": "DotplotView",
      "displayName": "Rhopilema (jellyfish) vs Ephydatia (sponge)",
      "views": [{ "assembly": "RES" }, { "assembly": "EMU" }],
      "tracks": ["alg_blocks"],
      "colorBy": "attribute:gene_group",
      "showColorLegend": true,
      "lineWidth": 3,
      "height": 940
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json with the four assemblies, the ortholog table"
echo "carrying its linkage groups, and a stacked default session colored by them."
echo "Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
