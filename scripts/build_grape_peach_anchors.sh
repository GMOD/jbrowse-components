#!/usr/bin/env bash
#
# Reproducibly build the pairwise grape vs peach MCScan anchors synteny view
# shown in website/docs/tutorials/mcscan_synteny.md, then wire up a runnable
# JBrowse.
#
# It downloads the grape and peach genomes (dna, CDS, GFF3) from Ensembl Plants
# release 58, runs the jcvi ortholog pipeline to produce grape.peach.anchors and
# grape.peach.anchors.simple, downloads JBrowse, and writes a config.json with
# the two assemblies, per-genome gene tracks, both MCScan synteny tracks, and a
# default session opening them together in a linear synteny view.
#
# Everything is pinned (fixed release, fixed jcvi thresholds), so re-running
# reproduces the same view. The three-genome .blocks variant of this pipeline is
# scripts/build_grape_peach_cacao_synteny.sh.
#
# Requires: jcvi + the LAST aligner, samtools, bgzip/tabix (htslib), wget, and
#           node (JBrowse CLI, fetched via npx unless `jbrowse` is on PATH).
# Usage:    bash scripts/build_grape_peach_anchors.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-grape_peach_anchors_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

BASE=http://ftp.ensemblgenomes.org/pub/plants/release-58

# ── Fetch genome (dna), CDS, GFF3 per species; index each FASTA ──────────────
# Heredoc columns: short name, Ensembl species name, assembly version.
while read -r name prefix asm; do
  species=$(echo "$prefix" | tr '[:upper:]' '[:lower:]')
  [ -f "$name.dna.fa.gz" ] || wget -O "$name.dna.fa.gz" "$BASE/fasta/$species/dna/$prefix.$asm.dna.toplevel.fa.gz"
  [ -f "$name.cds.fa.gz" ] || wget -O "$name.cds.fa.gz" "$BASE/fasta/$species/cds/$prefix.$asm.cds.all.fa.gz"
  [ -f "$name.gff3.gz" ]   || wget -O "$name.gff3.gz"   "$BASE/gff3/$species/$prefix.$asm.58.gff3.gz"
  [ -f "$name.fa" ]        || gunzip -c "$name.dna.fa.gz" > "$name.fa"
  [ -f "$name.fa.fai" ]    || samtools faidx "$name.fa"   # add-assembly needs the .fai
done <<'EOF'
grape  Vitis_vinifera   PN40024.v4
peach  Prunus_persica   Prunus_persica_NCBIv2
EOF

# ── jcvi: GFF3 -> BED (one primary isoform/gene) + CDS matching the BED names ─
for sp in grape peach; do
  python -m jcvi.formats.gff bed --type=mRNA --key=transcript_id \
    --primary_only "$sp.gff3.gz" -o "$sp.bed"
  python -m jcvi.formats.fasta format "$sp.cds.fa.gz" "$sp.cds"
done

# ── jcvi: one ortholog run writes both anchor files ──────────────────────────
# --no_strip_names keeps the gene ids byte-identical to the BEDs; the adapters
# throw on an id they can't resolve.
python -m jcvi.compara.catalog ortholog --no_strip_names grape peach

# ── Compress anchors + BEDs (the adapters read plain or gzipped) ─────────────
gzip -kf grape.peach.anchors grape.peach.anchors.simple grape.bed peach.bed

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP"

# The anchors + BEDs must sit beside config.json (add-track-json won't copy them)
cp grape.peach.anchors.gz grape.peach.anchors.simple.gz \
   grape.bed.gz peach.bed.gz "$APP"/

# One assembly per genome (copies each .fa + .fa.fai into the app dir)
for sp in grape peach; do
  jb add-assembly "$sp.fa" --name "$sp" --load copy --force --out "$APP"
done

# Per-genome gene tracks, so "Show only genes" has something to draw
for sp in grape peach; do
  gunzip -c "$sp.gff3.gz" | jb sort-gff | bgzip > "$sp.sorted.gff3.gz"
  tabix -f -p gff "$sp.sorted.gff3.gz"
  jb add-track "$sp.sorted.gff3.gz" -a "$sp" --name "$sp genes" \
    --trackId "${sp}_genes" --load copy --force --out "$APP"
done

# The gene-pair track (ribbons) and the block track (one feature per block)
cat > anchors_track.json <<'JSON'
{
  "type": "SyntenyTrack",
  "trackId": "grape_peach_anchors",
  "name": "Grape peach synteny (MCScan, anchors)",
  "assemblyNames": ["grape", "peach"],
  "adapter": {
    "type": "MCScanAnchorsAdapter",
    "uri": "grape.peach.anchors.gz",
    "bed1": "grape.bed.gz",
    "bed2": "peach.bed.gz",
    "assemblyNames": ["grape", "peach"]
  }
}
JSON
jb add-track-json anchors_track.json --out "$APP"

cat > anchors_simple_track.json <<'JSON'
{
  "type": "SyntenyTrack",
  "trackId": "grape_peach_anchors_simple",
  "name": "Grape peach synteny (MCScan, simple anchors)",
  "assemblyNames": ["grape", "peach"],
  "adapter": {
    "type": "MCScanSimpleAnchorsAdapter",
    "uri": "grape.peach.anchors.simple.gz",
    "bed1": "grape.bed.gz",
    "bed2": "peach.bed.gz",
    "assemblyNames": ["grape", "peach"]
  }
}
JSON
jb add-track-json anchors_simple_track.json --out "$APP"

# Default session: peach over grape, gene-pair ribbons between the panels and
# the block track as an LGVSyntenyDisplay row inside each one
cat > session.json <<'JSON'
{
  "name": "Grape vs Peach MCScan anchors",
  "views": [
    {
      "type": "LinearSyntenyView",
      "displayName": "Peach - Grape (MCScan anchors)",
      "drawCurves": true,
      "init": {
        "views": [
          {
            "assembly": "peach",
            "tracks": [
              {
                "trackId": "grape_peach_anchors_simple",
                "type": "LGVSyntenyDisplay",
                "height": 60
              }
            ]
          },
          {
            "assembly": "grape",
            "tracks": [
              {
                "trackId": "grape_peach_anchors_simple",
                "type": "LGVSyntenyDisplay",
                "height": 60
              }
            ]
          }
        ],
        "tracks": [["grape_peach_anchors", "grape_peach_anchors_simple"]]
      }
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json with the grape and peach assemblies, gene tracks,"
echo "both MCScan anchor synteny tracks, and a default session opening them."
echo "Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
