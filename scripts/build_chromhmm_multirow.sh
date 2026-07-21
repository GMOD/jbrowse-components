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
# Requires: bash 4+ (for the `declare -A` map), wget, awk/sed, bgzip/tabix
#           (htslib), and node (JBrowse CLI, fetched via npx unless `jbrowse` is
#           on PATH).
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
# map each UCSC filename token to its canonical ENCODE cell-line label
declare -A ct=(
  [Gm12878]=GM12878 [H1hesc]=H1-hESC [K562]=K562  [Hepg2]=HepG2 [Huvec]=HUVEC
  [Hmec]=HMEC       [Hsmm]=HSMM      [Nhek]=NHEK   [Nhlf]=NHLF
)
for f in wgEncodeBroadHmm*HMM.bed.gz; do
  tok=$(echo "$f" | sed -E 's/wgEncodeBroadHmm(.*)HMM.bed.gz/\1/')
  zcat "$f" | awk -v c="${ct[$tok]}" 'BEGIN{OFS="\t"} {print $0, c}'
done | sort -k1,1 -k2,2n > wgEncodeBroadHmm.multirow.bed

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
# The BedTabixAdapter columnNames name the extra column 10 `cellType` so the
# display can split on it; itemRgb (column 9) paints each feature its state
# color automatically. The CLI can't set columnNames/partitionField/rowOrder, so
# the track is written straight into config.json.
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
        "disableGeneHeuristic": true,
        "columnNames": [
          "chrom", "chromStart", "chromEnd", "name", "score", "strand",
          "thickStart", "thickEnd", "itemRgb", "cellType"
        ],
        "bedGzLocation": { "uri": "wgEncodeBroadHmm.multirow.bed.gz" },
        "index": { "location": { "uri": "wgEncodeBroadHmm.multirow.bed.gz.tbi" } }
      },
      "displays": [
        {
          "type": "LinearMultiRowFeatureDisplay",
          "displayId": "broad_chromhmm_multirow_hg19-LinearMultiRowFeatureDisplay",
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
echo "cluster (chr7:27,050,000-27,300,000), where the stem-cell line (H1-hESC)"
echo "reads as Polycomb-repressed while differentiated lines carry active states."
echo "Serve it and open in a browser, e.g.:"
echo "  npx --yes serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
