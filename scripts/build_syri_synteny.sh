#!/usr/bin/env bash
#
# Six Arabidopsis thaliana accessions compared the two ways SyRI's users compare
# them: each genome against the one above it, the stack plotsr draws, and each
# against Col-0, the reference every other track is annotated on. syri2jbrowse
# turns SyRI's typed regions (syntenic, inverted, translocated, duplicated) into
# the JBrowse config.
#
# Requires: awk, samtools, minimap2, syri2jbrowse
#           (pip install git+https://github.com/cmdcolin/syri2jbrowse),
#           the NCBI `datasets` CLI and unzip for a genome downloaded by
#           accession, and SyRI (`syri` on the PATH, or Docker, which
#           runs the biocontainers image)
# Usage:    bash build_syri_synteny.sh [outdir] [rows]
#
# Your own genomes: <rows> is a file of `<name> [assembly accession]` lines in
# stack order, the reference first. A chromosome-level <name>.fa already in the
# output directory is used as is, its homologous chromosomes named alike across
# genomes; a row without one needs the accession to download it.

set -euo pipefail

for tool in awk samtools minimap2 syri2jbrowse; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
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
    for tool in datasets unzip; do
      command -v "$tool" >/dev/null 2>&1 || {
        echo "error: '$tool' not found on PATH" >&2
        exit 1
      }
    done
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
done

echo "== the JBrowse config"
# plotsr's genomes file: each genome's FASTA and name, in stack order
for name in "${NAMES[@]}"; do
  printf '%s.fa\t%s\n' "$name" "$name"
done >genomes.txt
# --sr is each neighbouring pair, as plotsr takes them; --pair is each accession
# against the reference, which draws them as lanes in its coordinates
ARGS=(--genomes genomes.txt -o .)
for ((i = 1; i < ${#NAMES[@]}; i++)); do
  ARGS+=(--sr "${NAMES[i - 1]}_${NAMES[i]}.syri.out")
done
for name in "${NAMES[@]:2}"; do
  ARGS+=(--pair "$REFERENCE" "$name" "${REFERENCE}_$name.syri.out")
done
syri2jbrowse "${ARGS[@]}"
