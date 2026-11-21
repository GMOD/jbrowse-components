#!/usr/bin/env bash
#
# A bacterial genome annotated by Prokka and opened from Prokka's GenBank file,
# the dataset behind website/docs/tutorials/prokka_genbank.md.
#
# The assembly is E. coli O157:H7 Sakai (GCF_000008865.2: a chromosome and the
# plasmids pOSAK1 and pO157), fetched from the copy on jbrowse.org. Prokka
# annotates it, and the one GenBank file it writes loads as both the assembly
# and the gene track, with the plasmids marked circular and the gene names
# indexed for search.
#
# Requires: curl, prokka, and node (the JBrowse CLI is fetched via npx unless
#           `jbrowse` is on PATH, or JBROWSE_CLI names a command to run in its
#           place).
# Usage:    bash scripts/build_prokka_genbank.sh [outdir]
#           FASTA=my_assembly.fna CIRCULAR=contig_2,contig_3 NAME=my_genome \
#             LOCUSTAG=MYG DISPLAY_NAME="My genome" \
#             bash scripts/build_prokka_genbank.sh my_build
#
set -euo pipefail

OUTDIR="${1:-prokka_genbank_build}"
# an assembly of your own replaces the Sakai download; CIRCULAR lists the
# contigs to draw as rings, comma-separated, and RING the one the default
# session opens
FASTA="${FASTA:-}"
CIRCULAR="${CIRCULAR:-NC_002127.1,NC_002128.1}"
RING="${RING:-${CIRCULAR##*,}}"
NAME="${NAME:-sakai}"
LOCUSTAG="${LOCUSTAG:-SAKAI}"
DISPLAY_NAME="${DISPLAY_NAME:-E. coli O157:H7 Sakai (Prokka)}"
SAKAI_URL=https://jbrowse.org/demos/prokka_sakai/GCF_000008865.2_ASM886v2_genomic.fna.gz

for tool in curl prokka node; do
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

if [ -n "$FASTA" ]; then
  FASTA="$(cd "$(dirname "$FASTA")" && pwd)/$(basename "$FASTA")"
fi
mkdir -p "$OUTDIR"
cd "$OUTDIR"
APP=jbrowse2

# ── Inputs ──────────────────────────────────────────────────────────────────
if [ -z "$FASTA" ]; then
  if [ ! -s assembly.fna ]; then
    curl -fsSL "$SAKAI_URL" | gzip -dc >assembly.fna.part
    mv assembly.fna.part assembly.fna
  fi
  FASTA=assembly.fna
fi

# ── Annotation ──────────────────────────────────────────────────────────────
# --cpus 0 uses every core; --locustag prefixes each gene's locus_tag
if [ ! -s "annotation/$NAME.gbk" ]; then
  prokka --outdir annotation --prefix "$NAME" --locustag "$LOCUSTAG" \
    --cpus 0 --force "$FASTA"
fi

# ── JBrowse ─────────────────────────────────────────────────────────────────
circular_json=$(printf '%s' "$CIRCULAR" | sed 's/[^,][^,]*/"&"/g')
[ -f "$APP/index.html" ] || jb create "$APP" --branch main
jb add-assembly "annotation/$NAME.gbk" --name "$NAME" \
  --displayName "$DISPLAY_NAME" --load copy --out "$APP" --force \
  --config "{\"circularRefNames\":[$circular_json]}"
jb add-track "annotation/$NAME.gbk" --trackId "${NAME}_prokka" \
  --name "Prokka genes" --assemblyNames "$NAME" --load copy --out "$APP" \
  --force
jb text-index --out "$APP" --tracks "${NAME}_prokka" --force
jb set-default-session --out "$APP" --session - <<EOF
{
  "name": "$NAME",
  "views": [
    {
      "type": "CircularView",
      "assembly": "$NAME",
      "displayedRegionNames": ["$RING"],
      "tracks": ["${NAME}_prokka"]
    }
  ]
}
EOF

echo "built $OUTDIR/$APP; serve it with: npx --yes serve $OUTDIR/$APP"
