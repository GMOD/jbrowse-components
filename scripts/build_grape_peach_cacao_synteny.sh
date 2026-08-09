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

# Species table: short name, Ensembl species name, assembly version.
#
# The first three carry a genome because the stacked three-genome figure draws
# their gene tracks, so they are loaded as JBrowse assemblies. The rest are
# BLOCKS-ONLY mates: they appear solely as lanes on the grape axis in the
# one-vs-all figure, and MCScanBlocksAdapter resolves a lane entirely from the
# .blocks table plus that species' BED, so nothing reads their sequence. That is
# the difference between tens of MB of CDS and GFF3 per species and a genome
# download each.
ASSEMBLY_SPECIES='
grape  Vitis_vinifera   PN40024.v4
peach  Prunus_persica   Prunus_persica_NCBIv2
cacao  Theobroma_cacao  Theobroma_cacao_20110822
'
# Grape is a basal rosid, so these span the divergences rather than repeating
# one: two more rosid orders, and tomato as an asterid outgroup where the
# expectation is visibly fewer blocks. Fragaria and Malus are NOT in plants
# release 58; citrus is.
BLOCKS_ONLY_SPECIES='
arabidopsis  Arabidopsis_thaliana   TAIR10
poplar       Populus_trichocarpa    Pop_tri_v4
tomato       Solanum_lycopersicum   SL3.0
citrus       Citrus_clementina      Citrus_clementina_v1.0
'
MATES="peach cacao arabidopsis poplar tomato citrus"

# ── Fetch CDS + GFF3 per species, and the genome for the assembly ones ───────
while read -r name prefix asm; do
  [ -z "$name" ] && continue
  species=$(echo "$prefix" | tr '[:upper:]' '[:lower:]')
  [ -f "$name.cds.fa.gz" ] || wget -O "$name.cds.fa.gz" "$BASE/fasta/$species/cds/$prefix.$asm.cds.all.fa.gz"
  [ -f "$name.gff3.gz" ]   || wget -O "$name.gff3.gz"   "$BASE/gff3/$species/$prefix.$asm.58.gff3.gz"
  case " $(echo $ASSEMBLY_SPECIES | awk '{for(i=1;i<=NF;i+=3) printf "%s ", $i}') " in
    *" $name "*)
      [ -f "$name.dna.fa.gz" ] || wget -O "$name.dna.fa.gz" "$BASE/fasta/$species/dna/$prefix.$asm.dna.toplevel.fa.gz"
      [ -f "$name.fa" ]        || gunzip -c "$name.dna.fa.gz" > "$name.fa"
      [ -f "$name.fa.fai" ]    || samtools faidx "$name.fa"   # add-assembly needs the .fai
      ;;
  esac
done <<EOF
$ASSEMBLY_SPECIES
$BLOCKS_ONLY_SPECIES
EOF

# ── jcvi: GFF3 -> BED (one primary isoform/gene) + CDS matching the BED names ─
# Every derive step below is guarded on its output file, the same as the
# downloads above: the LAST alignment inside `catalog ortholog` is the long step
# here, and a re-run that redoes it pays for the whole pipeline again.
for sp in grape $MATES; do
  [ -f "$sp.bed" ] || python -m jcvi.formats.gff bed --type=mRNA \
    --key=transcript_id --primary_only "$sp.gff3.gz" -o "$sp.bed"
  [ -f "$sp.cds" ] || python -m jcvi.formats.fasta format "$sp.cds.fa.gz" "$sp.cds"
done

# NO refName translation anywhere in here, deliberately. The demo used to host a
# cacao assembly whose chromosomes are I..X where this Ensembl release calls them
# 1..10, and renaming the BED to match looked like a naming difference and is
# not one: the ten chromosome LENGTHS disagree, every one of them (chr1
# 38,988,864 here against 37,323,695 there), so they are different cacao builds
# and a rename would have placed these genes at another assembly's coordinates.
# Grape and peach needed no such thing -- their hosted FASTAs match this release
# name for name and length for length, 22/22 and 191/191. The fix was to host
# the cacao assembly this release annotates, so all three species and the BEDs
# come from one release.
#
# Renaming a refName is only ever legitimate when the mapping is UNAMBIGUOUS --
# an NCBI accession to a chromosome name, say, where the accession already
# identifies that exact sequence and `refNameAliases` is the right tool because
# the accession is unreadable rather than uncertain. "I" to "1" across two
# builds is not that: it is a guess that two sequences are the same one, and it
# fails silently by drawing genes at plausible wrong coordinates. Check the
# lengths before translating anything.

# ── jcvi: orthologs vs grape, MCScan each pair, join into one .blocks table ───
for sp in $MATES; do
  [ -f "grape.$sp.lifted.anchors" ] || \
    python -m jcvi.compara.catalog ortholog --no_strip_names grape "$sp"
  [ -f "grape.$sp.i1.blocks" ] || \
    python -m jcvi.compara.synteny mcscan grape.bed "grape.$sp.lifted.anchors" \
      --iter=1 -o "grape.$sp.i1.blocks"
done
# Each per-pair table is two columns, grape then the mate, so an N-way join
# emits the grape column N times. Keep column 1 and every even column after it:
# that is the grape anchor followed by one mate per lane, in MATES order, which
# is the order blockAssemblies and bedLocations have to list.
if [ ! -f grape.blocks ]; then
  keep=1; col=2
  for _ in $MATES; do keep="$keep,$col"; col=$((col + 2)); done
  # shellcheck disable=SC2086
  python -m jcvi.formats.base join $(for sp in $MATES; do printf 'grape.%s.i1.blocks ' "$sp"; done) \
    --noheader | cut -f"$keep" > grape.blocks
fi

# ── Compress blocks + BEDs (the adapter reads plain or gzipped) ──────────────
# shellcheck disable=SC2086
gzip -kf grape.blocks grape.bed $(for sp in $MATES; do printf '%s.bed ' "$sp"; done)

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP"

# The .blocks + BEDs must sit beside config.json (add-track-json won't copy them)
# shellcheck disable=SC2086
cp grape.blocks.gz grape.bed.gz $(for sp in $MATES; do printf '%s.bed.gz ' "$sp"; done) "$APP"/

# One assembly per genome (copies each .fa + .fa.fai into the app dir)
for sp in grape peach cacao; do
  jb add-assembly "$sp.fa" --name "$sp" --load copy --force --out "$APP"
done

# Per-genome gene tracks, so "Show only genes" has something to draw
for sp in grape peach cacao; do
  if [ ! -f "$sp.sorted.gff3.gz.tbi" ]; then
    gunzip -c "$sp.gff3.gz" | jb sort-gff | bgzip > "$sp.sorted.gff3.gz"
    tabix -f -p gff "$sp.sorted.gff3.gz"
  fi
  jb add-track "$sp.sorted.gff3.gz" -a "$sp" --name "$sp genes" \
    --trackId "${sp}_genes" --load copy --force --out "$APP"
done

# The one multi-way synteny track that backs every band. Generated rather than
# literal: blockAssemblies and bedLocations have to list grape then the mates in
# exactly the .blocks column order, and a hand-kept copy of that list is the one
# mistake the adapter's own error message calls out.
python3 - "$MATES" > blocks_track.json <<'PY'
import json, sys
mates = sys.argv[1].split()
names = ['grape'] + mates
print(json.dumps({
    'type': 'SyntenyTrack',
    'trackId': 'grape_peach_cacao_blocks',
    'name': 'Grape vs %s (MCScan blocks)' % ', '.join(mates),
    'assemblyNames': names,
    'adapter': {
        'type': 'MCScanBlocksAdapter',
        'uri': 'grape.blocks.gz',
        'blockAssemblies': names,
        'bedLocations': [{'uri': '%s.bed.gz' % n} for n in names],
        'assemblyNames': names,
    },
}, indent=2))
PY
# --update, so a second run overwrites the track rather than failing the build
# on "a track with that trackId already exists"
jb add-track-json blocks_track.json --update --out "$APP"

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
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
