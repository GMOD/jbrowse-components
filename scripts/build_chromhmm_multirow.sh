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

# ── Fetch the nine per-cell-type Broad HMM segmentation BEDs ──────────────────
UCSC=http://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeBroadHmm
ls wgEncodeBroadHmm*HMM.bed.gz >/dev/null 2>&1 \
  || wget -q -r -np -nd -A 'wgEncodeBroadHmm*HMM.bed.gz' "$UCSC/"

# ── Concatenate into one BED9 + a trailing `cellType` column, coordinate-sorted
# Each UCSC filename token maps to its canonical ENCODE cell-line label, which is
# what becomes a row label and what `rowOrder` in the config references.
cell_type() {
  case "$1" in
  wgEncodeBroadHmmGm12878HMM.bed.gz) echo GM12878 ;;
  wgEncodeBroadHmmH1hescHMM.bed.gz) echo H1-hESC ;;
  wgEncodeBroadHmmK562HMM.bed.gz) echo K562 ;;
  wgEncodeBroadHmmHepg2HMM.bed.gz) echo HepG2 ;;
  wgEncodeBroadHmmHuvecHMM.bed.gz) echo HUVEC ;;
  wgEncodeBroadHmmHmecHMM.bed.gz) echo HMEC ;;
  wgEncodeBroadHmmHsmmHMM.bed.gz) echo HSMM ;;
  wgEncodeBroadHmmNhekHMM.bed.gz) echo NHEK ;;
  wgEncodeBroadHmmNhlfHMM.bed.gz) echo NHLF ;;
  *) echo "unexpected file $1" >&2 && return 1 ;;
  esac
}

# The `#`-prefixed defline names the columns, so the adapter reads them from the
# file and the track config needs no `columnNames`. It is written outside the
# sort so it stays the first line.
{
  printf '#chrom\tchromStart\tchromEnd\tname\tscore\tstrand\tthickStart\tthickEnd\titemRgb\tcellType\n'
  for f in wgEncodeBroadHmm*HMM.bed.gz; do
    zcat "$f" | awk -v c="$(cell_type "$f")" 'BEGIN{OFS="\t"} {print $0, c}'
  done | sort -k1,1 -k2,2n
} > wgEncodeBroadHmm.multirow.bed

# already coordinate-sorted, so just compress + index (no bigBed conversion)
bgzip -f wgEncodeBroadHmm.multirow.bed
tabix -f -p bed wgEncodeBroadHmm.multirow.bed.gz

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi
[ -f "$APP/index.html" ] || jb create "$APP"
cp wgEncodeBroadHmm.multirow.bed.gz wgEncodeBroadHmm.multirow.bed.gz.tbi "$APP"/

# ── config.json: hg19 + the multi-row ChromHMM track ─────────────────────────
# The assembly is sourced entirely from UCSC (hgdownload), the same host the
# ENCODE segmentation BEDs came from, so the whole demo reads from one place.
# Column names come from the BED's own defline, so all the track has to say is
# which of them partitions the rows; itemRgb paints each feature its state color
# automatically. The CLI can't set partitionField/rowOrder, so the track is
# written straight into config.json.
cat > "$APP"/config.json <<'JSON'
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
          "rowOrder": [
            "GM12878", "H1-hESC", "K562", "HepG2", "HUVEC",
            "HMEC", "HSMM", "NHEK", "NHLF"
          ],
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
        "init": {
          "assembly": "hg19",
          "loc": "chr7:27,050,000-27,300,000",
          "tracks": ["broad_chromhmm_multirow_hg19"]
        }
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
