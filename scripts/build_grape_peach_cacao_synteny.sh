#!/usr/bin/env bash
#
# Reproducibly build the three-way grape / peach / cacao MCScan .blocks synteny
# view shown in website/docs/tutorials/multiway_synteny.md, then wire up a
# runnable JBrowse.
#
# It downloads the grape, peach, and cacao genomes (dna, CDS, GFF3) from Ensembl
# Plants release 58, runs the jcvi ortholog pipeline into one reference-anchored
# grape.blocks table, downloads JBrowse, and writes a config.json with the three
# assemblies, per-genome gene tracks, the MCScanBlocksAdapter synteny track, and
# a default session that stacks the three genomes peach - cacao - grape.
#
# Everything is pinned (fixed release, fixed jcvi thresholds), so re-running
# reproduces the same view.
#
# Requires: jcvi + the LAST aligner, samtools, bgzip/tabix (htslib), wget, and
#           node (JBrowse CLI, fetched via npx unless `jbrowse` is on PATH).
# Usage:    bash scripts/build_grape_peach_cacao_synteny.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-grape_peach_cacao_build}"
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
cacao  Theobroma_cacao  Theobroma_cacao_20110822
EOF

# ── jcvi: GFF3 -> BED (one primary isoform/gene) + CDS matching the BED names ─
for sp in grape peach cacao; do
  python -m jcvi.formats.gff bed --type=mRNA --key=transcript_id \
    --primary_only "$sp.gff3.gz" -o "$sp.bed"
  python -m jcvi.formats.fasta format "$sp.cds.fa.gz" "$sp.cds"
done

# ── jcvi: orthologs vs grape, MCScan each pair, join into one .blocks table ───
# cut drops col 3, the duplicate grape column the join emits from the 2nd table.
python -m jcvi.compara.catalog ortholog --no_strip_names grape peach
python -m jcvi.compara.catalog ortholog --no_strip_names grape cacao
python -m jcvi.compara.synteny mcscan grape.bed grape.peach.lifted.anchors \
  --iter=1 -o grape.peach.i1.blocks
python -m jcvi.compara.synteny mcscan grape.bed grape.cacao.lifted.anchors \
  --iter=1 -o grape.cacao.i1.blocks
python -m jcvi.formats.base join grape.peach.i1.blocks grape.cacao.i1.blocks \
  --noheader | cut -f1,2,4 > grape.blocks

# ── Compress blocks + BEDs (the adapter reads plain or gzipped) ──────────────
gzip -kf grape.blocks grape.bed peach.bed cacao.bed

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP"

# The .blocks + BEDs must sit beside config.json (add-track-json won't copy them)
cp grape.blocks.gz grape.bed.gz peach.bed.gz cacao.bed.gz "$APP"/

# One assembly per genome (copies each .fa + .fa.fai into the app dir)
for sp in grape peach cacao; do
  jb add-assembly "$sp.fa" --name "$sp" --load copy --force --out "$APP"
done

# Per-genome gene tracks, so "Show only genes" has something to draw
for sp in grape peach cacao; do
  gunzip -c "$sp.gff3.gz" | jb sort-gff | bgzip > "$sp.sorted.gff3.gz"
  tabix -f -p gff "$sp.sorted.gff3.gz"
  jb add-track "$sp.sorted.gff3.gz" -a "$sp" --name "$sp genes" \
    --trackId "${sp}_genes" --load copy --force --out "$APP"
done

# The one multi-way synteny track that backs every band
cat > blocks_track.json <<'JSON'
{
  "type": "SyntenyTrack",
  "trackId": "grape_peach_cacao_blocks",
  "name": "Grape / peach / cacao (MCScan blocks)",
  "assemblyNames": ["grape", "peach", "cacao"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "mcscanBlocksLocation": { "uri": "grape.blocks.gz" },
    "blockAssemblies": ["grape", "peach", "cacao"],
    "bedLocations": [
      { "uri": "grape.bed.gz" },
      { "uri": "peach.bed.gz" },
      { "uri": "cacao.bed.gz" }
    ],
    "assemblyNames": ["grape", "peach", "cacao"]
  }
}
JSON
jb add-track-json blocks_track.json --out "$APP"

# Default session: stack the three genomes peach - cacao - grape
cat > session.json <<'JSON'
{
  "name": "Grape / Peach / Cacao multi-way synteny",
  "views": [
    {
      "type": "LinearSyntenyView",
      "displayName": "Peach - Cacao - Grape (MCScan blocks)",
      "showColorLegend": false,
      "init": {
        "views": [
          { "assembly": "peach" },
          { "assembly": "cacao" },
          { "assembly": "grape" }
        ],
        "tracks": [["grape_peach_cacao_blocks"], ["grape_peach_cacao_blocks"]],
        "colorBy": "reference",
        "autoDiagonalize": true
      }
    }
  ]
}
JSON
jb set-default-session --session session.json --out "$APP"

echo
echo "Built $APP/config.json with the grape/peach/cacao assemblies, gene tracks,"
echo "the MCScan blocks synteny track, and a stacked default session."
echo "Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
