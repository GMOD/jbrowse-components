#!/usr/bin/env bash
#
# Reproducibly build the KHV-trio hap-ibd inheritance-block track shown in
# website/docs/tutorials/analyze_trio.md, then wire up a runnable JBrowse.
#
# It downloads the phased 1000 Genomes Kinh-Vietnamese trio (HG02024, chr1),
# runs hap-ibd to find identical-by-descent segments, collapses them into the
# painted BED9 track, downloads JBrowse, and writes a config.json with the hg38
# assembly plus the trio VCF and the hap-ibd tracks.
#
# Everything is pinned (fixed input URLs, fixed hap-ibd thresholds), so
# re-running reproduces the same track.
#
# Requires: java (8+), python3, curl, unzip, bgzip/tabix (htslib), and node
#           (for the JBrowse CLI, fetched via npx unless $JBROWSE is set).
# Usage:    bash scripts/build_khv_trio_hapibd.sh [outdir]
#
set -euo pipefail

# Absolute path to this script's dir, captured before we cd elsewhere, so the
# sibling hapibd_to_bed.py resolves no matter where the script is run from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OUTDIR="${1:-khv_trio_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# ── Pinned inputs ───────────────────────────────────────────────────────────
VCF_URL="https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz"
HAPIBD_JAR="https://faculty.washington.edu/browning/hap-ibd.jar"
MAPZIP="https://bochet.gcc.biostat.washington.edu/beagle/genetic_maps/plink.GRCh38.map.zip"
# GRCh38 sequence whose refnames are 1..22 (no "chr"), matching the trio VCF.
HG38_FA="https://jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz"

VCF=HG02024_VN049_KHVTrio.chr1.vcf.gz
# 1000 Genomes pedigree line: VN049 HG02024 HG02026 HG02025 (father, mother).
CHILD=HG02024; FATHER=HG02026; MOTHER=HG02025

# ── Fetch data + tools + genetic map ────────────────────────────────────────
[ -f "$VCF" ]        || curl -fsSL "$VCF_URL" -o "$VCF"
[ -f hap-ibd.jar ]   || curl -fsSL "$HAPIBD_JAR" -o hap-ibd.jar
if [ ! -f plink.chr1.GRCh38.map ]; then
  curl -fsSL "$MAPZIP" -o maps.zip
  # the trio VCF calls its chromosome "1", so use the no-chr map variant
  unzip -o maps.zip 'no_chr_in_chrom_field/plink.chr1.GRCh38.map' -d maps >/dev/null
  cp maps/no_chr_in_chrom_field/plink.chr1.GRCh38.map plink.chr1.GRCh38.map
fi

# ── Run hap-ibd ─────────────────────────────────────────────────────────────
java -jar hap-ibd.jar \
  gt="$VCF" \
  map=plink.chr1.GRCh38.map \
  out=trio min-seed=1.0 min-output=1.0

# ── Collapse IBD segments into the painted BED9 (father blues, mother reds) ──
python3 "$SCRIPT_DIR/hapibd_to_bed.py" trio.ibd.gz "$CHILD" "$FATHER" "$MOTHER" trio.hapibd.bed
sort -k1,1 -k2,2n trio.hapibd.bed | bgzip > trio.hapibd.bed.gz
tabix -f -p bed trio.hapibd.bed.gz

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ───────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

APP=jbrowse2
[ -f "$APP/index.html" ] || jb create "$APP"

# hg38 assembly (remote bgzip FASTA, refnames match the trio VCF's "1")
jb add-assembly "$HG38_FA" --name hg38 --force --out "$APP"

# trio VCF track, served straight from UCSC
jb add-track "$VCF_URL" \
  --name "KHV trio phased variants (chr1)" \
  --trackId khv_trio_vcf --assemblyNames hg38 --force --out "$APP"

# hap-ibd track: copy the BED in, then add the FeatureTrack with the multi-row
# display (the CLI can't set partitionField/rowOrder, so patch config.json).
cp trio.hapibd.bed.gz trio.hapibd.bed.gz.tbi "$APP"/
python3 - "$APP/config.json" <<'PY'
import json, sys
path = sys.argv[1]
cfg = json.load(open(path))
track = {
    "type": "FeatureTrack",
    "trackId": "khv_trio_hapibd",
    "name": "KHV trio hap-ibd haplotype blocks (chr1)",
    "assemblyNames": ["hg38"],
    "adapter": {
        "type": "BedTabixAdapter",
        "disableGeneHeuristic": True,
        "columnNames": ["chrom", "chromStart", "chromEnd", "name", "score",
                        "strand", "thickStart", "thickEnd", "itemRgb", "parenthap"],
        "bedGzLocation": {"uri": "trio.hapibd.bed.gz"},
        "index": {"location": {"uri": "trio.hapibd.bed.gz.tbi"}},
    },
    "displays": [{
        "type": "LinearMultiRowFeatureDisplay",
        "displayId": "khv_trio_hapibd-LinearMultiRowFeatureDisplay",
        "partitionField": "parenthap",
        "rowOrder": ["Father hap1", "Father hap2", "Mother hap1", "Mother hap2"],
    }],
}
cfg["tracks"] = [t for t in cfg["tracks"] if t.get("trackId") != track["trackId"]]
cfg["tracks"].append(track)
json.dump(cfg, open(path, "w"), indent=2)
PY

echo
echo "Built $APP/config.json with the hg38 assembly + trio VCF + hap-ibd tracks."
echo "Serve it and open in a browser, e.g.:"
echo "  npx serve $(pwd)/$APP"
echo "or open $(pwd)/$APP/config.json in JBrowse Desktop via File -> Session ->"
echo "Open config.json or .jbrowse file... (the same session, no re-adding tracks)."
