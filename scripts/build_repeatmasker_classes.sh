#!/usr/bin/env bash
#
# Serve YOUR OWN RepeatMasker output as one labelled lane per repeat class, the
# arrangement worked in website/docs/tutorials/repeatmasker_classes.md against a
# hosted UCSC track.
#
# The hosted track is a BED whose header already names a `repClass` column.
# RepeatMasker's own `.out` has no such column: it writes one `class/family`
# field ("LINE/L1", or just "Simple_repeat" when the two are the same). So this
# splits that field in two and writes a BED whose header names the columns
# UCSC's does, bgzips and tabixes it, and adds the track with the multi-row
# display already selected.
#
# Its first seven columns are UCSC's seven, in UCSC's order, so the
# `tabix | awk` check at the end of the tutorial reads your own file unchanged
# ($7 is the class, $6 the family).
#
# Requires: samtools, bgzip + tabix (htslib), awk, and node (the JBrowse CLI is
#           fetched via npx unless `jbrowse` is already on PATH).
# Usage:    bash scripts/build_repeatmasker_classes.sh genome.fa repeats.out [outdir]
#
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "usage: bash $(basename "$0") genome.fa repeats.out [outdir]" >&2
  echo "  genome.fa   the FASTA RepeatMasker was run against (plain or bgzipped)" >&2
  echo "  repeats.out RepeatMasker's .out for that FASTA (plain or gzipped)" >&2
  exit 1
fi

for tool in samtools bgzip tabix htsfile awk sort node; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

# Both inputs are resolved before the cd below, so a relative path on the
# command line still names the file the caller meant.
abspath() { case "$1" in /*) printf '%s\n' "$1" ;; *) printf '%s\n' "$PWD/$1" ;; esac; }
GENOME=$(abspath "$1")
REPEATS=$(abspath "$2")
OUTDIR="${3:-repeatmasker_build}"

# The assembly name JBrowse will use, and the name the track's assemblyNames
# has to match. Derived from the FASTA rather than asked for, then passed to
# add-assembly explicitly so the two cannot disagree.
ASM=$(basename "$GENOME")
ASM=${ASM%.gz}
ASM=${ASM%.fa}
ASM=${ASM%.fasta}
ASM=${ASM%.fna}

mkdir -p "$OUTDIR"
cd "$OUTDIR"
APP=jbrowse2   # relative to $OUTDIR, so the [ -f ] guard resolves after the cd

# ── The FASTA, indexed ───────────────────────────────────────────────────────
# A plain gzip FASTA cannot be faidx'd and a bgzipped one can, and the two share
# the .gz extension, so this is decided by reading the file rather than by its
# name. `htsfile` is the test, not `bgzip -t`: bgzip decompresses a plain gzip
# member happily and exits 0, so it reports every .gz as fine and the mistake
# surfaces one step later as "samtools faidx is broken".
FA=$(basename "$GENOME")
case "$GENOME" in
  *.gz)
    if htsfile "$GENOME" | grep -q BGZF; then
      cp -f "$GENOME" "$FA"
    else
      echo "note: $FA is plain gzip, recompressing with bgzip so it can be indexed"
      gzip -dc "$GENOME" | bgzip >"$FA"
    fi
    ;;
  *) cp -f "$GENOME" "$FA" ;;
esac
samtools faidx "$FA"

# ── JBrowse (uses an installed `jbrowse`, else the CLI via npx) ──────────────
# Defined before the conversion below, which uses `jb sort-bed`.
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

# ── .out to a UCSC-shaped BED ────────────────────────────────────────────────
# The header line is what names the columns: BedTabixAdapter reads them off it,
# which is why `partitionField: "repClass"` in the track config below can name a
# column that is not part of the BED spec at all. `sort-bed` is what keeps it
# first, where tabix expects it: it moves every `#` line to the top and sorts
# the rest under LC_ALL=C, which a hand-rolled `sort` gets wrong in any other
# locale.
{
  printf '#genoName\tgenoStart\tgenoEnd\tname\tstrand\trepFamily\trepClass\tswScore\tmilliDiv\n'
  case "$REPEATS" in
    *.gz) gzip -dc "$REPEATS" ;;
    *) cat "$REPEATS" ;;
  esac | awk 'BEGIN { OFS = "\t" }
    # A .out opens with three header lines and separates blocks with blank
    # ones. A data row is the one whose first field is the SW score, which is
    # the only line shape that starts with a bare integer.
    $1 ~ /^[0-9]+$/ {
      # "LINE/L1" splits; "Simple_repeat" does not, and UCSC fills repFamily
      # with the class again for exactly those rows.
      n = split($11, cf, "/")
      cls = cf[1]
      fam = (n > 1) ? cf[2] : cf[1]
      # The .out strand column is "+" or "C" for complement, not "+" or "-".
      strand = ($9 == "C") ? "-" : "+"
      # .out positions are 1-based and inclusive; BED starts are 0-based.
      print $5, $6 - 1, $7, $10, strand, fam, cls, $1, int($2 * 10 + 0.5)
    }'
} >rmsk.bed
jb sort-bed rmsk.bed | bgzip >rmsk.bed.gz
tabix -f -p bed rmsk.bed.gz

CLASSES=$(gzip -dc rmsk.bed.gz | awk -F'\t' '!/^#/ { c[$7]++ } END { print length(c) }')
echo "converted $(basename "$REPEATS") to rmsk.bed.gz, $CLASSES repeat classes"

[ -f "$APP/index.html" ] || jb create "$APP"
jb add-assembly "$FA" --name "$ASM" --load copy --force --out "$APP"
cp -f rmsk.bed.gz rmsk.bed.gz.tbi "$APP"/

# The CLI cannot set partitionField, so the track is written as JSON. The
# multi-row entry is listed first, which is what makes it the display the track
# opens with; the plain one after it stays a menu click away.
#
# sampleColorMap is deliberately partial. A class not named in it still gets a
# lane, colored from the categorical palette by its position, so this is the
# list of classes whose color should not move as you pan rather than a list of
# what exists. @ASSEMBLY@ is a real JSON string so the heredoc parses on its
# own, which is what scripts/check-build-scripts.py validates it as.
sed "s|@ASSEMBLY@|$ASM|" >track.json <<'JSON'
{
  "type": "FeatureTrack",
  "trackId": "rmsk_classes",
  "name": "RepeatMasker by class",
  "assemblyNames": ["@ASSEMBLY@"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "rmsk.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "rmsk_classes-LinearMultiRowFeatureDisplay",
      "partitionField": "repClass",
      "sampleColorMap": {
        "SINE": "#e41a1c",
        "LINE": "#377eb8",
        "LTR": "#4daf4a",
        "DNA": "#984ea3",
        "Simple_repeat": "#ff7f00",
        "Low_complexity": "#a65628"
      },
      "showRowSeparators": true,
      "height": 200
    },
    {
      "type": "LinearBasicDisplay",
      "displayId": "rmsk_classes-LinearBasicDisplay"
    }
  ]
}
JSON
jb add-track-json track.json --update --out "$APP"

echo
echo "Built $APP/config.json with the $ASM assembly and a RepeatMasker track"
echo "that opens as one lane per repeat class. Serve it and open in a browser:"
echo "  npx --yes serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Open"
echo "session -> Open config.json or .jbrowse file..."
