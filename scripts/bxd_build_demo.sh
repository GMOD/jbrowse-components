#!/usr/bin/env bash
#
# Reproducibly build the BXD systems-genetics demo from
# website/docs/tutorials/bxd_qtl.md: the 198-strain chromosome painting plus the
# GeneNetwork QTL scan for coat color, whose chr4 peak interval holds Tyrp1,
# then wire up a runnable JBrowse.
#
# It downloads the GeneNetwork BXD consensus genotypes, builds the painting BED
# with one Python helper, fetches the QTL scan already computed from
# GeneNetwork's mapping API, downloads JBrowse, and writes a config.json with
# mm10 (from jbrowse.org), the Manhattan track, the painting, and a default
# session on chr4.
#
# Everything is pinned (fixed source URLs, fixed trait ID 11280), so re-running
# reproduces the same tracks.
#
# Requires: curl, jq (reshaping GeneNetwork's scan), python3 (the painting's
#           run-length encoding), bgzip/tabix (htslib), and node (JBrowse CLI,
#           fetched via npx unless `jbrowse` is on PATH).
# Usage:    bash scripts/bxd_build_demo.sh [outdir]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # so the .py helpers resolve after cd

# Sibling helpers this script runs, fetched next to it when absent, so a bare
# `curl -fO` of this one file behaves the same as a repo checkout.
HELPERS=(bxd_geno_to_painting_bed.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUTDIR="${1:-bxd_demo}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"
APP=jbrowse2   # relative to $OUTDIR, so the [ -f ] guard resolves after the cd

# ── Source data (GeneNetwork consensus genotypes), skip if present ───────────
# The phenotypes are not downloaded: GeneNetwork maps them itself, and the scans
# below are fetched already computed rather than recomputed here.
[ -f BXD.geno ] || curl -fsSL -o BXD.geno https://gn1.genenetwork.org/genotypes/BXD.geno

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi
[ -f "$APP/index.html" ] || jb create "$APP"

# ── Chromosome-painting BED (one row per strain) ─────────────────────────────
python3 "$SCRIPT_DIR/bxd_geno_to_painting_bed.py" BXD.geno bxd_painting.bed
jb sort-bed bxd_painting.bed | bgzip > "$APP"/bxd_painting.bed.gz
tabix -f -p bed "$APP"/bxd_painting.bed.gz

# ── QTL scans, downloaded from GeneNetwork rather than recomputed ────────────
# GeneNetwork is a mapping service: it runs GEMMA, a linear mixed model that
# accounts for the relatedness among BXD strains, and serves the whole per-marker
# scan over its API. Recomputing one here with a plain regression would ignore
# that relatedness and answer a different question, so this only reshapes.
# 11280 = coat color, a Mendelian-scale peak on chr4 (LOD 48). Most BXD traits
# are polygenic and scan flat by comparison, which is why this one carries the
# figure: there has to be a peak worth sorting the painting underneath.
GN='https://genenetwork.org/api/v_pre1/mapping?db=BXDPublish&method=gemma'
scan() {  # <trait_id> <out_stem>
  [ -f "$2.json" ] || curl -fsSL -o "$2.json" "$GN&trait_id=$1"
  {
    printf '#chrom\tstart\tend\tname\tscore\tstrand\tlod\n'
    jq -r '.[0][] | [ "chr" + (.chr|tostring), ((.Mb*1000000)|round),
                      ((.Mb*1000000)|round + 1), .name, ".", ".",
                      (.lod_score*10000|round/10000) ] | @tsv' "$2.json" |
      sort -k1,1 -k2,2n
  } | bgzip > "$APP/$2.tsv.gz"
  tabix -f -p bed "$APP/$2.tsv.gz"
  echo "$2: $(jq -r '.[0] | max_by(.lod_score) | "peak \(.name) chr\(.chr):\(.Mb)Mb LOD \(.lod_score*100|round/100)"' "$2.json")"
}
scan 11280 bxd_gwas_coatcolor

# ── config.json: mm10 from jbrowse.org, the scan + the painting local ─────────
cat > "$APP"/config.json <<'JSON'
{
  "assemblies": [
    {
      "name": "mm10",
      "aliases": ["GRCm38"],
      "sequence": {
        "type": "ReferenceSequenceTrack",
        "trackId": "mm10-ReferenceSequenceTrack",
        "adapter": {
          "type": "BgzipFastaAdapter",
          "uri": "https://jbrowse.org/genomes/mm10/fasta/mm10.fa.gz"
        }
      },
      "refNameAliases": {
        "adapter": {
          "type": "RefNameAliasAdapter",
          "uri": "https://hgdownload.soe.ucsc.edu/goldenpath/mm10/bigZips/latest/mm10.chromAlias.txt"
        }
      },
      "cytobands": {
        "adapter": {
          "type": "CytobandAdapter",
          "uri": "https://jbrowse.org/ucsc/mm10/cytoBandIdeo.bed.gz"
        }
      }
    }
  ],
  "tracks": [
    {
      "type": "GWASTrack",
      "trackId": "bxd_gwas_coatcolor_mm10",
      "name": "BXD QTL: coat color (GEMMA, Tyrp1, chr4)",
      "assemblyNames": ["mm10"],
      "category": ["GeneNetwork / BXD"],
      "adapter": {
        "type": "GWASAdapter",
        "uri": "bxd_gwas_coatcolor.tsv.gz",
        "scoreColumn": "lod"
      },
      "displays": [
        {
          "type": "LinearManhattanDisplay",
          "displayId": "bxd_gwas_coatcolor_mm10-LinearManhattanDisplay"
        }
      ]
    },
    {
      "type": "FeatureTrack",
      "trackId": "bxd_chromosome_painting_mm10",
      "name": "BXD chromosome painting (GeneNetwork, 198 strains)",
      "assemblyNames": ["mm10"],
      "category": ["GeneNetwork / BXD"],
      "adapter": {
        "type": "BedTabixAdapter",
        "disableGeneHeuristic": true,
        "bedGzLocation": { "uri": "bxd_painting.bed.gz" },
        "index": { "location": { "uri": "bxd_painting.bed.gz.tbi" } }
      },
      "displays": [
        {
          "type": "LinearMultiRowFeatureDisplay",
          "displayId": "bxd_chromosome_painting_mm10-LinearMultiRowFeatureDisplay",
          "partitionField": "sample",
          "legend": [
            { "label": "B (C57BL/6J)", "color": "rgb(65,105,225)" },
            { "label": "D (DBA/2J)", "color": "rgb(220,60,50)" },
            { "label": "H (heterozygous)", "color": "rgb(150,150,150)" }
          ]
        }
      ]
    }
  ],
  "defaultSession": {
    "name": "BXD systems genetics (GeneNetwork)",
    "views": [
      {
        "id": "bxd_lgv",
        "type": "LinearGenomeView",
        "assembly": "mm10",
        "loc": "chr4",
        "tracks": ["bxd_gwas_coatcolor_mm10", "bxd_chromosome_painting_mm10"]
      }
    ]
  }
}
JSON

echo
echo "Built $APP/config.json with mm10, the 198-strain chromosome painting, and"
echo "GeneNetwork's GEMMA scan for coat color. It opens on chr4 with the"
echo "Manhattan over the painting; right-click the painting near the peak and"
echo "pick \"Sort rows by color here\" to reveal the B/D split. Serve it:"
echo "  npx --yes serve $(pwd)/$APP"
