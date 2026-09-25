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
# Usage:    bash build_syri_synteny.sh [outdir]
#
# Your own genomes: replace ROWS with `<name> <assembly accession>` lines in
# stack order, the reference first, or drop chromosome-level FASTAs named
# <name>.fa into the output directory, whose homologous chromosomes share a
# name, and the download step skips them.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(syri_to_paf.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUT="${1:-syri_synteny}"
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
mapfile -t NAMES < <(cut -d' ' -f1 <<<"$ROWS")
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

# each accession against the reference, then each against the one above it;
# the reference's first mate is in both
PAIRS=()
for name in "${NAMES[@]:1}"; do
  PAIRS+=("${REFERENCE}_$name")
done
for ((i = 2; i < ${#NAMES[@]}; i++)); do
  PAIRS+=("${NAMES[i - 1]}_${NAMES[i]}")
done

echo "== SyRI on each pair"
for pair in "${PAIRS[@]}"; do
  ref="${pair%%_*}"
  qry="${pair#*_}"
  if [ ! -s "$pair.syri.out" ]; then
    # asm5 is for genomes of one species; --eqx writes the =/X CIGAR SyRI reads
    minimap2 -ax asm5 --eqx -t "$THREADS" "$ref.fa" "$qry.fa" |
      samtools sort -O BAM -o "$pair.bam" -
    # -F B says the alignment is BAM; --nc runs the chromosomes in parallel
    run_syri -c "$pair.bam" -r "$ref.fa" -q "$qry.fa" -F B --prefix "$pair." --nc 5
  fi
  python3 "$SCRIPT_DIR/syri_to_paf.py" "$pair.syri.out" --prefix "$pair"
done

echo "== one PAF for every pair, one BED for every accession on the reference"
for pair in "${PAIRS[@]}"; do cat "$pair.paf"; done >syri_pangenome.paf
# the reference's pairs are the regions on the reference
{
  head -n1 "${PAIRS[0]}.regions.bed"
  tail -q -n +2 "${REFERENCE}"_*.regions.bed | sort -k1,1 -k2,2n
} | bgzip >syri_regions.bed.gz
tabix -f -p bed syri_regions.bed.gz

echo "== config.json"
NAMES="${NAMES[*]}" python3 - <<'PY'
import json
import os

names = os.environ['NAMES'].split()
reference = names[0]


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
                    'color': {'domain': ['SYN', 'INV', 'TRANS', 'INVTR', 'DUP', 'INVDP']},
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
