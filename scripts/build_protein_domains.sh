#!/usr/bin/env bash
#
# Calls Pfam domains on YOUR OWN gene models and serves them as a track under
# the genes, the arrangement worked in
# website/docs/tutorials/protein_domains.md on the honey bee RefSeq annotation.
#
# gffread translates each transcript's CDS, hmmscan calls Pfam domains on the
# proteins with Pfam's own gathering thresholds, and `jbrowse
# make-protein-features` places each domain back on the exons that encode it.
# The script then builds a JBrowse with the genome, the genes and the domains.
#
# Requires: samtools, gffread, hmmscan + hmmpress (HMMER 3), bgzip + tabix
#           (htslib), and node (the JBrowse CLI is fetched via npx unless
#           `jbrowse` is already on PATH).
# Usage:    bash scripts/build_protein_domains.sh genome.fa genes.gff3 [outdir]
#
# Pfam-A.hmm (about 1.5 GB pressed) downloads into the output directory once.
# hmmscan over a whole insect proteome takes an hour or two on 16 cores; set
# THREADS to change the core count.
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "usage: bash $(basename "$0") genome.fa genes.gff3 [outdir]" >&2
  exit 1
fi

for tool in samtools gffread hmmscan hmmpress bgzip tabix node; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

abspath() { case "$1" in /*) printf '%s\n' "$1" ;; *) printf '%s\n' "$PWD/$1" ;; esac; }
GENOME=$(abspath "$1")
GENES=$(abspath "$2")
OUTDIR="${3:-protein_domains_build}"
THREADS="${THREADS:-16}"

ASM=$(basename "$GENOME")
ASM=${ASM%.gz}
ASM=${ASM%.fa}
ASM=${ASM%.fasta}
ASM=${ASM%.fna}

mkdir -p "$OUTDIR"
cd "$OUTDIR"
APP=jbrowse2

if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

# ── The FASTA, uncompressed and indexed ──────────────────────────────────────
# gffread cannot read a gzipped FASTA, so both it and JBrowse read a plain one
FA="$ASM.fa"
case "$GENOME" in
  *.gz) gzip -dc "$GENOME" >"$FA" ;;
  *) cp -f "$GENOME" "$FA" ;;
esac
samtools faidx "$FA"

# ── The genes, sorted and indexed ────────────────────────────────────────────
case "$GENES" in
  *.gz) gzip -dc "$GENES" ;;
  *) cat "$GENES" ;;
esac >genes.gff3
jb sort-gff genes.gff3 | bgzip >genes.gff3.gz
tabix -f -p gff genes.gff3.gz

# ── Proteins, then Pfam domains on them ──────────────────────────────────────
# -y writes each transcript's CDS translated, named by the transcript ID;
# -S spells a stop codon `*`, which HMMER reads and gffread's own `.` is not
gffread -S -y proteins.fa -g "$FA" genes.gff3

if [ ! -f Pfam-A.hmm.h3m ]; then
  curl -fL -o Pfam-A.hmm.gz https://ftp.ebi.ac.uk/pub/databases/Pfam/current_release/Pfam-A.hmm.gz
  gzip -d Pfam-A.hmm.gz
  hmmpress Pfam-A.hmm
fi

# --cut_ga: Pfam's curated per-family gathering threshold, the cutoff InterPro
# uses, in place of one E-value for every family
hmmscan --cut_ga --cpu "$THREADS" --noali --domtblout pfam.domtblout \
  Pfam-A.hmm proteins.fa >/dev/null

jb make-protein-features genes.gff3 pfam.domtblout --out pfam.bed.gz

# ── JBrowse ──────────────────────────────────────────────────────────────────
[ -f "$APP/index.html" ] || jb create "$APP"
jb add-assembly "$FA" --name "$ASM" --load copy --force --out "$APP"
jb add-track genes.gff3.gz --trackId genes --name Genes -a "$ASM" \
  --load copy --force --out "$APP"
jb add-track pfam.bed.gz --trackId pfam_domains --name "Pfam domains" \
  -a "$ASM" --load copy --force --out "$APP" \
  --config '{"adapter":{"disableGeneHeuristic":true},"displayDefaults":{"encoding":{"color":"name"}}}'
jb text-index --tracks genes --attributes Name,gene --force --out "$APP"

echo
echo "Built $APP with $ASM, its genes and their Pfam domains. Serve it with"
echo "  npx --yes serve $(pwd)/$APP"
