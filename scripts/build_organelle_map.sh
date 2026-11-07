#!/usr/bin/env bash
#
# A circular map of an organelle or plasmid from one GenBank accession, the
# dataset behind website/docs/tutorials/organelle_map.md.
#
# NCBI hands back the sequence as FASTA and its annotation as GFF3. The genome
# loads as an assembly marked circular and translated with the accession's
# genetic code, the genes as a GFF3 track split by strand and colored by type,
# and the default session opens the genome as a circle.
#
# Requires: curl, samtools, bgzip + tabix (htslib), and node (the JBrowse CLI is
#           fetched via npx unless `jbrowse` is on PATH, or JBROWSE_CLI names a
#           command to run in its place).
# Usage:    bash scripts/build_organelle_map.sh [outdir]
#           ACC=NC_000932.1 GENETIC_CODE=11 NAME=arabidopsis_chloroplast \
#             DISPLAY_NAME="Arabidopsis chloroplast (NC_000932.1)" \
#             bash scripts/build_organelle_map.sh
#
set -euo pipefail

OUTDIR="${1:-organelle_map_build}"
# NC_012920.1 is the human mitochondrion; table 2 is NCBI's vertebrate
# mitochondrial code (11 for a plastid or a bacterial plasmid)
ACC="${ACC:-NC_012920.1}"
GENETIC_CODE="${GENETIC_CODE:-2}"
NAME="${NAME:-human_mito}"
DISPLAY_NAME="${DISPLAY_NAME:-Human mitochondrion ($ACC)}"

for tool in curl samtools bgzip tabix node; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

if [ -n "${JBROWSE_CLI:-}" ]; then
  jb() { $JBROWSE_CLI "$@"; }
elif [[ "$(jbrowse --version 2>/dev/null)" == *"version "[5-9].* ]]; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli@next "$@"; }
fi

mkdir -p "$OUTDIR"
cd "$OUTDIR"
APP=jbrowse2

# ── Inputs ──────────────────────────────────────────────────────────────────
fetch() {
  local url=$1 file=$2
  if [ ! -s "$file" ]; then
    curl -fsSL -o "$file.part" "$url"
    mv "$file.part" "$file"
  fi
}

fetch "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=$ACC&rettype=fasta" genome.fa
fetch "https://www.ncbi.nlm.nih.gov/sviewer/viewer.cgi?db=nuccore&report=gff3&id=$ACC" genes.gff3

samtools faidx genome.fa
jb sort-gff genes.gff3 | bgzip >genes.gff.gz
tabix -f -p gff genes.gff.gz

# ── JBrowse ─────────────────────────────────────────────────────────────────
[ -f "$APP/index.html" ] || jb create "$APP" --branch main
jb add-assembly genome.fa --name "$NAME" --displayName "$DISPLAY_NAME" \
  --load copy --out "$APP" --force \
  --config "{\"circularRefNames\":[\"$ACC\"],\"geneticCodes\":{\"$ACC\":$GENETIC_CODE}}"
jb add-track genes.gff.gz --trackId mito_genes --name "NCBI genes" \
  --assemblyNames "$NAME" --load copy --out "$APP" --force \
  --displayDefaults '{"labels":{"name":"jexl:feature.gene || feature.product || feature.name || feature.gbkey || feature.id"},"facet":{"field":"strand"},"encoding":{"color":"type"},"height":250}'
jb set-default-session --out "$APP" --session - <<EOF
{
  "name": "$ACC as a circle",
  "views": [
    {
      "type": "CircularView",
      "assembly": "$NAME",
      "legend": { "show": true },
      "tracks": ["mito_genes"]
    }
  ]
}
EOF

echo "built $OUTDIR/$APP; serve it with: npx --yes serve $OUTDIR/$APP"
