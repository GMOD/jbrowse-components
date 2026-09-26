#!/usr/bin/env bash
#
# Six Arabidopsis thaliana accessions compared the two ways SyRI's users compare
# them: each genome against the one above it, the stack plotsr draws, and each
# against Col-0, the reference every other track is annotated on. SyRI's typed
# regions (syntenic, inverted, translocated, duplicated) become one multi-genome
# PAF, whose records carry their type and plotsr's color for it as tags, and a
# BED of every accession's regions on Col-0.
#
# Requires: curl, unzip, awk, python3, samtools, minimap2, bgzip and tabix, the
#           NCBI `datasets` CLI, and SyRI (`syri` on the PATH, or Docker, which
#           runs the biocontainers image)
# Usage:    bash build_syri_synteny.sh [outdir] [rows]
#
# Your own genomes: <rows> is a file of `<name> [assembly accession]` lines in
# stack order, the reference first. A chromosome-level <name>.fa already in the
# output directory is used as is, its homologous chromosomes named alike across
# genomes; a row without one needs the accession to download it.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(syri_to_paf.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUT="${1:-syri_synteny}"
ROWS_FILE="${2:+$(realpath "$2")}"
mkdir -p "$OUT"
cd "$OUT"

THREADS="${THREADS:-4}"
SYRI_IMAGE=quay.io/biocontainers/syri:1.7.1--py310h7e8219e_1

# Col-0 is TAIR10; the others are chromosome-level assemblies of Jiao and
# Schneeberger 2020, the first three in the order plotsr's own figure stacks
ROWS="Col-0 GCF_000001735.4
Ler GCA_902460285.1
Cvi GCA_902460275.1
Eri GCA_902460315.1
Kyo GCA_902460305.1
Sha GCA_902460295.1"
if [ -n "$ROWS_FILE" ]; then
  ROWS="$(grep -v '^[[:space:]]*$' "$ROWS_FILE")"
fi
mapfile -t NAMES < <(awk '{print $1}' <<<"$ROWS")
REFERENCE="${NAMES[0]}"

run_syri() {
  if command -v syri >/dev/null; then
    syri "$@"
  else
    docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/data -w /data "$SYRI_IMAGE" syri "$@"
  fi
}

echo "== the assemblies, nuclear chromosomes only, named Chr1 to Chr5"
while read -r name accession; do
  if [ ! -s "$name.fa" ]; then
    if [ -z "${accession:-}" ]; then
      echo "no $name.fa, and no accession to download it" >&2
      exit 1
    fi
    datasets download genome accession "$accession" --include genome \
      --filename "$name.zip" --no-progressbar
    unzip -o -q "$name.zip" -d "$name.ncbi"
    # SyRI pairs chromosomes by name, so both genomes have to spell them alike;
    # the organelles and unplaced contigs carry no "chromosome N" in the header
    awk '
      /^>/ {
        keep = match($0, /chromosome:? ?[1-5]([^0-9]|$)/) && $0 !~ /mitochond|chloroplast/
        if (keep) { n = substr($0, RSTART, RLENGTH); gsub(/[^0-9]/, "", n); print ">Chr" n }
        next
      }
      keep { print }' "$name.ncbi"/ncbi_dataset/data/*/*.fna >"$name.fa"
    rm -rf "$name.zip" "$name.ncbi"
  fi
  samtools faidx "$name.fa"
  cut -f1,2 "$name.fa.fai" >"$name.chrom.sizes"
done <<<"$ROWS"

# each accession against the reference, then each against the one above it;
# the reference's first mate is in both
PAIRS=()
for name in "${NAMES[@]:1}"; do
  PAIRS+=("$REFERENCE $name")
done
for ((i = 2; i < ${#NAMES[@]}; i++)); do
  PAIRS+=("${NAMES[i - 1]} ${NAMES[i]}")
done

echo "== SyRI on each pair"
for p in "${PAIRS[@]}"; do
  read -r ref qry <<<"$p"
  pair="${ref}_$qry"
  if [ ! -s "$pair.syri.out" ]; then
    # asm5 is for genomes of one species; --eqx writes the =/X CIGAR SyRI reads
    minimap2 -cx asm5 --eqx -t "$THREADS" "$ref.fa" "$qry.fa" >"$pair.aln.paf"
    # -F P says the alignment is PAF; --nc runs the chromosomes in parallel
    run_syri -c "$pair.aln.paf" -r "$ref.fa" -q "$qry.fa" -F P --prefix "$pair." --nc 5
  fi
  python3 "$SCRIPT_DIR/syri_to_paf.py" "$pair.syri.out" --reference "$ref" --query "$qry"
done

echo "== one PAF for every pair, one BED for every accession on the reference"
for p in "${PAIRS[@]}"; do cat "${p/ /_}.paf"; done >syri_pangenome.paf
{
  head -n1 "${REFERENCE}_${NAMES[1]}.regions.bed"
  for name in "${NAMES[@]:1}"; do
    tail -n +2 "${REFERENCE}_$name.regions.bed"
  done | sort -k1,1 -k2,2n
} | bgzip >syri_regions.bed.gz
tabix -f -p bed syri_regions.bed.gz

echo "== config.json"
NAMES="${NAMES[*]}" python3 - <<'PY'
import json
import os

names = os.environ['NAMES'].split()
reference = names[0]
syri_types = ['SYN', 'INV', 'TRANS', 'INVTR', 'DUP', 'INVDP']


def assembly(name):
    return {
        'name': name,
        'sequence': {
            'type': 'ReferenceSequenceTrack',
            'trackId': f'{name}-ReferenceSequenceTrack',
            'adapter': {
                'type': 'ChromSizesAdapter',
                'uri': f'{name}.chrom.sizes',
            },
        },
    }


config = {
    '$schema': 'https://jbrowse.org/jb2/schema/v5/config.json',
    'assemblies': [assembly(name) for name in names],
    'tracks': [
        {
            'type': 'SyntenyTrack',
            'trackId': 'syri_pangenome',
            'name': 'SyRI regions',
            'assemblyNames': names,
            'adapter': {
                'type': 'MultiGenomePAFAdapter',
                'uri': 'syri_pangenome.paf',
                'attributeColumns': ['syri', 'color'],
            },
            'displays': [
                {
                    'type': 'MultiWaySyntenyDisplay',
                    'displayId': 'syri_pangenome-MultiWaySyntenyDisplay',
                    'domain': names[1:],
                    'ribbonColor': {'field': 'syri', 'domain': syri_types},
                }
            ],
        },
        {
            'type': 'FeatureTrack',
            'trackId': f'syri_regions_on_{reference}',
            'name': f'SyRI regions on {reference}, by accession',
            'assemblyNames': [reference],
            'adapter': {
                'type': 'BedTabixAdapter',
                'uri': 'syri_regions.bed.gz',
                'disableGeneHeuristic': True,
            },
            'displays': [
                {
                    'type': 'LinearMultiRowFeatureDisplay',
                    'displayId': f'syri_regions_on_{reference}-LinearMultiRowFeatureDisplay',
                    'rows': {'field': 'query', 'domain': names[1:]},
                    # the key in plotsr's order; the blocks keep their itemRgb
                    'color': {'domain': syri_types},
                }
            ],
        },
    ],
}
with open('config.json', 'w') as fh:
    json.dump(config, fh, indent=2)
    fh.write('\n')
PY

echo "Wrote $(pwd)/config.json, syri_pangenome.paf, syri_regions.bed.gz, *.chrom.sizes"
