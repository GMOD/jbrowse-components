#!/usr/bin/env bash
#
# The age of every Alu copy along hg38, the dataset behind
# website/docs/tutorials/alu_age.md.
#
# One scored BED becomes one track that plots a numeric column: each copy's
# divergence from its consensus as a bar coloured by subfamily lineage when
# zoomed in, the count per bin with the AluY count over it when zoomed out, and
# a `jbrowse make-density` sidecar past the fetch budget. The track is a mark
# display declared in JSON, so the same config over another family's rows, or
# another genome's RepeatMasker BED, is a change of file and of field name.
#
# With no arguments it cuts the Alu rows out of jbrowse.org's copy of UCSC's
# hg38 RepeatMasker table. Given a RepeatMasker-shaped BED (the one
# build_repeatmasker_classes.sh writes, header line included) and the FASTA it
# was masked against, it builds the same track over that file.
#
# Requires: bgzip + tabix (htslib), samtools (for a FASTA's .fai),
#           bedGraphToBigWig (UCSC), curl, awk, and node (the JBrowse CLI is
#           fetched via npx unless `jbrowse` is on PATH).
# Usage:    bash scripts/build_alu_age.sh [outdir]
#           bash scripts/build_alu_age.sh rmsk.bed.gz genome.fa [outdir]
#           FAMILY=L1 YOUNG=L1HS bash scripts/build_alu_age.sh ...
#
set -euo pipefail

for tool in bgzip tabix samtools bedGraphToBigWig curl awk node; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

abspath() { case "$1" in /*) printf '%s\n' "$1" ;; *) printf '%s\n' "$PWD/$1" ;; esac; }

# The repeat family cut out of the table (its repFamily column), and the name
# prefix of that family's youngest lineage, which the zoomed-out overlay counts.
FAMILY="${FAMILY:-Alu}"
YOUNG="${YOUNG:-AluY}"

if [ $# -ge 2 ]; then
  RMSK=$(abspath "$1")
  GENOME=$(abspath "$2")
  OUTDIR="${3:-alu_age_build}"
  ASM=$(basename "$GENOME")
  ASM=${ASM%.gz}
  ASM=${ASM%.fa}
  ASM=${ASM%.fasta}
  ASM=${ASM%.fna}
else
  RMSK=""
  GENOME=""
  OUTDIR="${1:-alu_age_build}"
  ASM=hg38
fi

mkdir -p "$OUTDIR"
cd "$OUTDIR"
APP=jbrowse2

HUB=https://jbrowse.org/ucsc/hg38
UCSC=https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips

# ── Inputs ──────────────────────────────────────────────────────────────────
# UCSC's RepeatMasker table is a bgzipped BED whose header line names its
# columns: repFamily in the sixth, and milliDiv, the copy's divergence from its
# consensus in tenths of a percent, further along. A reader's own file needs
# the same header, since the field names in the track config below are read
# off it.
if [ -n "$RMSK" ]; then
  cp -f "$RMSK" rmsk.bed.gz
  FA=$(basename "$GENOME")
  cp -f "$GENOME" "$FA"
  samtools faidx "$FA"
else
  [ -f rmsk.bed.gz ] || curl -fsSLo rmsk.bed.gz "$HUB/rmsk.bed.gz"
  [ -f hg38.chrom.sizes ] || curl -fsSLo hg38.chrom.sizes "$UCSC/hg38.chrom.sizes"
  FA=""
fi

# ── One family's rows ───────────────────────────────────────────────────────
# Filtering keeps the input's sort order and the header line, so the cut file
# only needs its own index.
BED="$FAMILY.bed.gz"
gzip -dc rmsk.bed.gz |
  awk -F'\t' -v fam="$FAMILY" '/^#/ || $6 == fam' |
  bgzip >"$BED"
tabix -f -p bed "$BED"

# ── The density sidecar ─────────────────────────────────────────────────────
# Counts feature starts per 1 kb bin into <file>.density.bw beside the input.
# --assembly reads the reference lengths off a FASTA's .fai; --chrom-sizes
# takes a two-column table instead, which is what the hg38 hub publishes.
if [ -n "$FA" ]; then
  jb make-density "$BED" --assembly "$FA"
else
  jb make-density "$BED" --chrom-sizes hg38.chrom.sizes
fi

# ── JBrowse ─────────────────────────────────────────────────────────────────
[ -f "$APP/index.html" ] || jb create "$APP"
if [ -n "$FA" ]; then
  jb add-assembly "$FA" --name "$ASM" --load copy --force --out "$APP"
else
  jb add-assembly "$UCSC/hg38.2bit" --name hg38 --type twoBit --force --out "$APP"
fi
cp -f "$BED" "$BED.tbi" "${BED%.gz}.density.bw" "$APP"/

# The CLI cannot write a marks list, so the track is JSON. @PLACEHOLDERS@ are
# real JSON strings, so the heredoc parses on its own.
#
# Mark 1 draws zoomed in: one bar per copy, milliDiv on the axis, coloured by
# the first four characters of the name (AluJ, AluS, AluY), which the formula
# step writes into `lineage`. Mark 2 draws zoomed out: the count per bin, the
# bin width following the zoom, and past the fetch budget the sidecar's bins in
# its place. Mark 3 is the youngest lineage's count per bin, over mark 2.
sed -e "s|@ASSEMBLY@|$ASM|g" -e "s|@FAMILY@|$FAMILY|g" -e "s|@BED@|$BED|g" \
  -e "s|@BW@|${BED%.gz}.density.bw|g" -e "s|@YOUNG@|$YOUNG|g" >track.json <<'JSON'
{
  "type": "FeatureTrack",
  "trackId": "@FAMILY@_age",
  "name": "@FAMILY@ copies",
  "assemblyNames": ["@ASSEMBLY@"],
  "adapter": {
    "type": "BedTabixAdapter",
    "bedGzLocation": { "uri": "@BED@" },
    "index": { "location": { "uri": "@BED@.tbi" } },
    "densityAdapter": {
      "type": "BigWigAdapter",
      "bigWigLocation": { "uri": "@BW@" }
    }
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "@FAMILY@_age-LinearMarkDisplay",
      "marks": [
        {
          "shape": "bar",
          "transform": [
            {
              "type": "formula",
              "expr": "jexl:substring(feature.name, 0, 4)",
              "as": "lineage"
            }
          ],
          "encoding": {
            "y": "milliDiv",
            "color": {
              "field": "lineage",
              "scale": "categorical",
              "domain": ["AluJ", "AluS", "AluY", "FLAM", "FRAM"],
              "palette": ["#4575b4", "#fdae61", "#d73027", "#8c8c8c", "#8c8c8c"]
            }
          },
          "maxBpPerPx": 100
        },
        {
          "shape": "bar",
          "source": "density",
          "transform": [
            { "type": "bin", "step": "auto" },
            {
              "type": "aggregate",
              "groupby": ["start", "end"],
              "ops": [{ "op": "count" }]
            }
          ],
          "encoding": { "y": "count", "color": "#c0c0c0" },
          "minBpPerPx": 100
        },
        {
          "shape": "bar",
          "transform": [
            { "type": "filter", "expr": "jexl:startsWith(feature.name, '@YOUNG@')" },
            { "type": "bin", "step": "auto" },
            {
              "type": "aggregate",
              "groupby": ["start", "end"],
              "ops": [{ "op": "count" }]
            }
          ],
          "encoding": { "y": "count", "color": "#d73027" },
          "minBpPerPx": 100
        }
      ]
    }
  ]
}
JSON
jb add-track-json track.json --out "$APP" --update

echo "built $OUTDIR/$APP; serve it with: npx --yes serve $OUTDIR/$APP"
