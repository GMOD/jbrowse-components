#!/usr/bin/env bash
#
# Four Arabidopsis thaliana accessions stacked the way plotsr draws them: each
# genome aligned to the one above it, SyRI's typed regions (syntenic, inverted,
# translocated, duplicated) as the ribbons of a linear synteny view, colored by
# the type SyRI gave them.
#
# SyRI's syri.out is a region table, and a JBrowse ortholog table is a pair
# table joined to one BED per genome, so the conversion is a rename:
# scripts/syri_to_blocks.py writes each top-level region to both BEDs under its
# SyRI id and one table row carrying its type and that type's color.
#
# Requires: curl, unzip, awk, python3, samtools, minimap2, the NCBI `datasets`
#           CLI, and SyRI (`syri` on the PATH, or Docker, which runs the
#           biocontainers image)
# Usage:    bash build_syri_synteny.sh [outdir]
#
# Your own genomes: replace ROWS with `<name> <assembly accession>` lines in
# stack order, or drop chromosome-level FASTAs named <name>.fa into the output
# directory, whose homologous chromosomes share a name, and the download step
# skips them.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(syri_to_blocks.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUT="${1:-syri_synteny}"
mkdir -p "$OUT"
cd "$OUT"

THREADS="${THREADS:-4}"
SYRI_IMAGE=quay.io/biocontainers/syri:1.7.1--py310h7e8219e_1

# Col-0 is TAIR10; the other three are the chromosome-level assemblies of Jiao
# and Schneeberger 2020, which plotsr's own figure stacks in this order.
ROWS="Col-0 GCF_000001735.4
Ler GCA_902460285.1
Cvi GCA_902460275.1
Eri GCA_902460315.1"

run_syri() {
  if command -v syri >/dev/null; then
    syri "$@"
  else
    docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/data -w /data "$SYRI_IMAGE" syri "$@"
  fi
}

echo "== the four assemblies, nuclear chromosomes only, named Chr1 to Chr5"
while read -r name accession; do
  [ -s "$name.fa" ] && continue
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
  samtools faidx "$name.fa"
  cut -f1,2 "$name.fa.fai" >"$name.chrom.sizes"
done <<<"$ROWS"

echo "== each genome against the one above it"
prev=""
while read -r name _; do
  if [ -n "$prev" ] && [ ! -s "${prev}_$name.syri.out" ]; then
    # asm5 is for genomes of one species; --eqx writes the =/X CIGAR SyRI reads
    minimap2 -ax asm5 --eqx -t "$THREADS" "$prev.fa" "$name.fa" |
      samtools sort -O BAM -o "${prev}_$name.bam" -
    # -F B says the alignment is BAM; --nc runs the chromosomes in parallel
    run_syri -c "${prev}_$name.bam" -r "$prev.fa" -q "$name.fa" -F B \
      --prefix "${prev}_$name." --nc 5
  fi
  prev="$name"
done <<<"$ROWS"

echo "== a pair table and two BEDs per pair"
prev=""
while read -r name _; do
  if [ -n "$prev" ]; then
    python3 "$SCRIPT_DIR/syri_to_blocks.py" "${prev}_$name.syri.out" \
      --prefix "${prev}_$name"
  fi
  prev="$name"
done <<<"$ROWS"

echo "== config.json"
ROWS="$ROWS" python3 - <<'PY'
import json
import os

names = [row.split()[0] for row in os.environ['ROWS'].splitlines()]


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


def pair(upper, lower):
    prefix = f'{upper}_{lower}'
    return {
        'type': 'SyntenyTrack',
        'trackId': f'syri_{prefix}',
        'name': f'{upper} vs {lower}, SyRI regions',
        'assemblyNames': [upper, lower],
        'adapter': {
            'type': 'MCScanBlocksAdapter',
            'uri': f'{prefix}.blocks',
            'blockAssemblies': [upper, lower],
            'bedLocations': [
                {'uri': f'{prefix}.{upper}.bed'},
                {'uri': f'{prefix}.{lower}.bed'},
            ],
            'attributeColumns': ['type', 'color', 'length'],
        },
    }


config = {
    '$schema': 'https://jbrowse.org/jb2/schema/v5/config.json',
    'assemblies': [assembly(name) for name in names],
    'tracks': [pair(a, b) for a, b in zip(names, names[1:])],
}
with open('config.json', 'w') as fh:
    json.dump(config, fh, indent=2)
    fh.write('\n')
PY

echo "Wrote $(pwd)/config.json, *.blocks, *.bed, *.chrom.sizes"
