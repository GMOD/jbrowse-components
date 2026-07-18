#!/usr/bin/env bash
#
# Reproducibly build the BXD systems-genetics demo from
# website/docs/tutorials/bxd_qtl.md: the 198-strain chromosome painting plus two
# single-marker QTL scans (coat color, peaking at Tyrp1 on chr4, and the subtler
# brain-weight peak on chr19), then wire up a runnable JBrowse.
#
# It downloads the GeneNetwork BXD consensus genotypes and the rqtl/qtl2data BXD
# phenotypes, builds the painting BED and both GWAS tables with the two Python
# helpers, downloads JBrowse, and writes a config.json with mm10 (from
# jbrowse.org), both Manhattan tracks, the painting, and a default session on
# chr4.
#
# Everything is pinned (fixed source URLs, fixed trait IDs: 11280 coat color,
# 10672 brain weight), so re-running reproduces the same tracks.
#
# Requires: curl, python3 (numpy + scipy for the scan, pandas to pull a trait
#           column), bgzip/tabix (htslib), and node (JBrowse CLI, fetched via npx
#           unless `jbrowse` is on PATH). The two Python helpers must sit next to
#           this script.
# Usage:    bash scripts/bxd_build_demo.sh [outdir]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # so the .py helpers resolve after cd
OUTDIR="${1:-bxd_demo}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"
APP=jbrowse2   # relative to $OUTDIR, so the [ -f ] guard resolves after the cd

# ── Source data (GeneNetwork genotypes + rqtl phenotypes), skip if present ────
[ -f BXD.geno ]      || curl -fL -o BXD.geno https://gn1.genenetwork.org/genotypes/BXD.geno
[ -f bxd_pheno.csv ] || curl -fL -o bxd_pheno.csv \
  https://raw.githubusercontent.com/rqtl/qtl2data/master/BXD/bxd_pheno.csv

# ── Set up JBrowse (uses an installed `jbrowse`, else the CLI via npx) ────────
if command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi
[ -f "$APP/index.html" ] || jb create "$APP"

# ── Chromosome-painting BED (one row per strain) ─────────────────────────────
python3 "$SCRIPT_DIR/bxd_geno_to_painting_bed.py" BXD.geno bxd_painting.bed
(head -1 bxd_painting.bed; tail -n +2 bxd_painting.bed | sort -k1,1 -k2,2n) \
  | bgzip > "$APP"/bxd_painting.bed.gz
tabix -f -p bed "$APP"/bxd_painting.bed.gz

# ── Two single-marker QTL scans off the SAME genotype matrix ─────────────────
# trait 11280 = coat color (peaks at Tyrp1, chr4); 10672 = brain weight (chr19).
# Pull each trait column out of bxd_pheno.csv as a `strain,value` file, then scan.
scan() {  # <trait_id> <out_stem>
  python3 - "$1" "$2.pheno.csv" <<'PY'
import sys
import pandas as pd
tid, out = sys.argv[1], sys.argv[2]
df = pd.read_csv('bxd_pheno.csv', comment='#')  # skips the leading # metadata lines
df[['id', tid]].dropna().to_csv(out, index=False, header=['strain', 'value'])
PY
  python3 "$SCRIPT_DIR/bxd_qtl_scan.py" BXD.geno "$2.pheno.csv" "$2.tsv"
  (head -1 "$2.tsv"; tail -n +2 "$2.tsv" | sort -k1,1 -k2,2n) | bgzip > "$APP/$2.tsv.gz"
  tabix -f -p bed "$APP/$2.tsv.gz"
}
scan 11280 bxd_gwas_coatcolor
scan 10672 bxd_gwas_brainweight

# ── config.json: mm10 from jbrowse.org, both scans + the painting local ───────
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
      "name": "BXD QTL: coat color (peak at Tyrp1, chr4)",
      "assemblyNames": ["mm10"],
      "category": ["GeneNetwork / BXD"],
      "adapter": {
        "type": "GWASAdapter",
        "bedGzLocation": { "uri": "bxd_gwas_coatcolor.tsv.gz" },
        "index": { "location": { "uri": "bxd_gwas_coatcolor.tsv.gz.tbi" } }
      },
      "displays": [
        {
          "type": "LinearManhattanDisplay",
          "displayId": "bxd_gwas_coatcolor_mm10-LinearManhattanDisplay"
        }
      ]
    },
    {
      "type": "GWASTrack",
      "trackId": "bxd_gwas_brainweight_mm10",
      "name": "BXD QTL: brain weight (subtler peak, chr19)",
      "assemblyNames": ["mm10"],
      "category": ["GeneNetwork / BXD"],
      "adapter": {
        "type": "GWASAdapter",
        "bedGzLocation": { "uri": "bxd_gwas_brainweight.tsv.gz" },
        "index": { "location": { "uri": "bxd_gwas_brainweight.tsv.gz.tbi" } }
      },
      "displays": [
        {
          "type": "LinearManhattanDisplay",
          "displayId": "bxd_gwas_brainweight_mm10-LinearManhattanDisplay"
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
          "showTree": true
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
        "init": {
          "assembly": "mm10",
          "loc": "chr4",
          "tracks": ["bxd_gwas_coatcolor_mm10", "bxd_chromosome_painting_mm10"]
        }
      }
    ]
  }
}
JSON

echo
echo "Built $APP/config.json with mm10, the 198-strain chromosome painting, and"
echo "two QTL scans (coat color on chr4, brain weight on chr19). It opens on chr4"
echo "with the coat-color Manhattan over the painting; right-click the painting"
echo "near the peak and pick \"Sort rows by color here\" to reveal the B/D split."
echo "Add the brain-weight track and jump to chr19 for the subtler peak. Serve it:"
echo "  npx --yes serve $(pwd)/$APP"
