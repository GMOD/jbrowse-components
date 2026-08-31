#!/usr/bin/env bash
#
# Reproducibly build the pairwise grape vs peach MCScan anchors synteny view
# shown in website/docs/tutorials/mcscan_synteny_grape_peach.md, then wire up
# a runnable JBrowse.
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
  [ -f "$sp.bed" ] || python -m jcvi.formats.gff bed --type=mRNA \
    --key=transcript_id --primary_only "$sp.gff3.gz" -o "$sp.bed"
  [ -f "$sp.cds" ] || python -m jcvi.formats.fasta format "$sp.cds.fa.gz" "$sp.cds"
done

# ── jcvi: one ortholog run writes both anchor files ──────────────────────────
# --no_strip_names keeps the gene ids byte-identical to the BEDs. Without it the
# adapters drop every row whose gene neither BED has, which for a whole-file
# suffix mismatch is every row, and the track fails with "none of the N rows
# ... name genes present in both BED files".
#
# Guarded like every other step, because this one is the LAST alignment and by
# far the longest: an unguarded re-run paid for it again before reaching the
# config steps below.
[ -f grape.peach.anchors ] || \
  python -m jcvi.compara.catalog ortholog --no_strip_names grape peach

# ── Compress anchors + BEDs (the adapters read plain or gzipped) ─────────────
gzip -kf grape.peach.anchors grape.peach.anchors.simple grape.bed peach.bed

# ── How many grape chromosomes does each peach chromosome answer to? ─────────
# The dotplot's own claim, read off the file instead of off the picture: resolve
# each block's first gene on each side through the BEDs, and count blocks and
# anchors per chromosome pair. A peach chromosome with one strong grape partner
# would put its blocks on the diagonal once the axes are ordered; several strong
# partners is a column crossing several rows, which no ordering removes.
python3 - <<'PY'
import collections
import gzip


def bed(path):
    with gzip.open(path, 'rt') as fh:
        rows = (line.split('\t') for line in fh)
        return {r[3].strip(): r[0] for r in rows if len(r) > 3}


grape, peach = bed('grape.bed.gz'), bed('peach.bed.gz')
anchors = collections.Counter()
with gzip.open('grape.peach.anchors.simple.gz', 'rt') as fh:
    for line in fh:
        f = line.rstrip('\n').split('\t')
        if len(f) >= 6 and f[0] in grape and f[2] in peach:
            anchors[(peach[f[2]], grape[f[0]])] += int(f[4])

partners = collections.defaultdict(list)
for (pp, gr), n in anchors.items():
    partners[pp].append((n, gr))
print()
print('grape chromosomes each peach chromosome shares blocks with:')
for pp in sorted(partners):
    strong = sorted((t for t in partners[pp] if t[0] >= 100), reverse=True)
    named = ', '.join(f'{gr} ({n} anchors)' for n, gr in strong)
    print(f'  {pp:6s} {len(strong):2d} partners over 100 anchors: {named}')
PY

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
  if [ ! -f "$sp.sorted.gff3.gz.tbi" ]; then
    gunzip -c "$sp.gff3.gz" | jb sort-gff | bgzip > "$sp.sorted.gff3.gz"
    tabix -f -p gff "$sp.sorted.gff3.gz"
  fi
  jb add-track "$sp.sorted.gff3.gz" -a "$sp" --name "$sp genes" \
    --trackId "${sp}_genes" --load copy --force --out "$APP"
done

# The gene-pair track (ribbons) and the block track (one feature per block).
# --update, so a second run overwrites each track rather than failing the build
# on "a track with that trackId already exists"
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
jb add-track-json anchors_track.json --update --out "$APP"

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
jb add-track-json anchors_simple_track.json --update --out "$APP"

# Default session: peach over grape, gene-pair ribbons between the panels and
# the block track as an LGVSyntenyDisplay row inside each one
cat > session.json <<'JSON'
{
  "name": "Grape vs Peach MCScan anchors",
  "views": [
    {
      "type": "LinearSyntenyView",
      "displayName": "Peach - Grape (MCScan anchors)",
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
      "tracks": [["grape_peach_anchors", "grape_peach_anchors_simple"]],
      "drawCurves": true
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
