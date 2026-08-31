#!/usr/bin/env bash
#
# Reproducibly build the multi-row ChromHMM chromatin-state track shown in
# website/docs/tutorials/chromhmm.md, then wire up a runnable JBrowse.
#
# It downloads the nine UCSC ENCODE Broad HMM 15-state segmentation BEDs (hg19,
# one per cell type), concatenates them into a single BED9 + `cellType` column,
# bgzips/tabixes it, downloads JBrowse, and writes a config.json with the hg19
# assembly and one FeatureTrack whose LinearMultiRowFeatureDisplay partitions on
# `cellType`, so the one file draws as nine color-coded rows.
#
# Everything is pinned (fixed UCSC download dir, fixed cell-type order), so
# re-running reproduces the same track.
#
# Requires: wget, awk, bgzip/tabix (htslib), and node (JBrowse CLI, fetched via
#           npx unless `jbrowse` is on PATH).
# Usage:    bash scripts/build_chromhmm_multirow.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-chromhmm_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"
APP=jbrowse2   # relative to $OUTDIR, so the [ -f ] guard resolves after the cd

# ── The nine cell types, once ────────────────────────────────────────────────
# `<UCSC filename token>:<canonical ENCODE label>`, in the order the rows are
# drawn in. This one list decides which files are fetched, the label each row
# gets, and the `rowOrder` written into config.json. It used to live in three
# places that had to agree: a recursive wget over the whole UCSC directory, a
# case statement mapping filename to label, and rowOrder typed out again in the
# heredoc. A tenth file appearing upstream would have been pulled in by the
# crawl with no label to give it.
UCSC=http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeBroadHmm
CELL_TYPES=(
  Gm12878:GM12878
  H1hesc:H1-hESC
  K562:K562
  Hepg2:HepG2
  Huvec:HUVEC
  Hmec:HMEC
  Hsmm:HSMM
  Nhek:NHEK
  Nhlf:NHLF
)

bed_file() { echo "wgEncodeBroadHmm${1%%:*}HMM.bed.gz"; }

for entry in "${CELL_TYPES[@]}"; do
  f=$(bed_file "$entry")
  [ -f "$f" ] || wget -q -O "$f" "$UCSC/$f"
done

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ───────
# Defined before the conversion below, which uses `jb sort-bed`.
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

# ── Concatenate into one BED9 + a trailing `cellType` column ─────────────────
# The `#`-prefixed defline names the columns, so the adapter reads them from the
# file and the track config needs no `columnNames`. `sort-bed` is what keeps it
# on top: it moves every `#` line there and sorts the rest under LC_ALL=C, which
# is the order tabix wants and the one a hand-rolled `sort` gets wrong in any
# other locale.
{
  printf '#chrom\tchromStart\tchromEnd\tname\tscore\tstrand\tthickStart\tthickEnd\titemRgb\tcellType\n'
  for entry in "${CELL_TYPES[@]}"; do
    gzip -dc "$(bed_file "$entry")" \
      | awk -v c="${entry##*:}" 'BEGIN{OFS="\t"} {print $0, c}'
  done
} > wgEncodeBroadHmm.multirow.bed
jb sort-bed wgEncodeBroadHmm.multirow.bed | bgzip > wgEncodeBroadHmm.multirow.bed.gz
tabix -f -p bed wgEncodeBroadHmm.multirow.bed.gz

[ -f "$APP/index.html" ] || jb create "$APP"
cp wgEncodeBroadHmm.multirow.bed.gz wgEncodeBroadHmm.multirow.bed.gz.tbi "$APP"/

# ── config.json: hg19 + the multi-row ChromHMM track ─────────────────────────
# The assembly is sourced entirely from UCSC (hgdownload), the same host the
# ENCODE segmentation BEDs came from, so the whole demo reads from one place.
# Column names come from the BED's own defline, so all the track has to say is
# which of them partitions the rows; itemRgb paints each feature its state color
# automatically. The CLI can't set partitionField/rowOrder, so the track is
# written straight into config.json.
#
# `rowOrder` is substituted from CELL_TYPES rather than typed out a second time.
# The placeholder is a real JSON string so the heredoc still parses on its own,
# which is what scripts/check-build-scripts.py validates it as.
ROW_ORDER=$(printf '"%s", ' "${CELL_TYPES[@]#*:}")
sed "s|\"@ROW_ORDER@\"|${ROW_ORDER%, }|" > "$APP"/config.json <<'JSON'
{
  "assemblies": [
    {
      "name": "hg19",
      "aliases": ["GRCh37"],
      "sequence": {
        "type": "ReferenceSequenceTrack",
        "trackId": "hg19-ReferenceSequenceTrack",
        "adapter": {
          "type": "TwoBitAdapter",
          "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hg19/bigZips/hg19.2bit"
        }
      },
      "refNameAliases": {
        "adapter": {
          "type": "RefNameAliasAdapter",
          "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hg19/bigZips/hg19.chromAlias.txt"
        }
      }
    }
  ],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "broad_chromhmm_multirow_hg19",
      "name": "ChromHMM chromatin state (Broad ENCODE, 9 cell types)",
      "assemblyNames": ["hg19"],
      "category": ["ENCODE", "Chromatin state"],
      "adapter": {
        "type": "BedTabixAdapter",
        "uri": "wgEncodeBroadHmm.multirow.bed.gz"
      },
      "displays": [
        {
          "type": "LinearMultiRowFeatureDisplay",
          "partitionField": "cellType",
          "rowOrder": ["@ROW_ORDER@"],
          "height": 200
        }
      ]
    }
  ],
  "defaultSession": {
    "name": "ChromHMM chromatin states (Broad ENCODE)",
    "views": [
      {
        "id": "chromhmm_lgv",
        "type": "LinearGenomeView",
        "assembly": "hg19",
        "loc": "chr7:27,050,000-27,300,000",
        "tracks": ["broad_chromhmm_multirow_hg19"]
      }
    ]
  }
}
JSON

echo
echo "Built $APP/config.json with the hg19 assembly and the multi-row ChromHMM"
echo "track (nine cell types, one color-coded row each). It opens on the HOXA"
echo "cluster (chr7:27,050,000-27,300,000), where each cell type opens the part"
echo "of the cluster its own lineage uses and leaves the rest repressed."
echo "Serve it and open in a browser, e.g.:"
echo "  npx --yes serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
