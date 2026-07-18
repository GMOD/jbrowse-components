#!/usr/bin/env bash
#
# One-shot, reproducible build of the BXD QTL demo from
# website/docs/tutorials/bxd_qtl.md. Downloads JBrowse, builds both data files
# from their public GeneNetwork + rqtl sources, writes a ready-to-serve
# config.json, and prints how to view it.
#
# Usage:   bash scripts/bxd_build_demo.sh [output_dir]     (default: bxd_demo)
#
# Requires: bash, curl, node/npx, python3 (pandas + numpy + scipy), and htslib
# (bgzip, tabix). The two Python helpers must sit next to this script.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-bxd_demo}"
APP="$OUT/jbrowse2"

mkdir -p "$OUT"
cd "$OUT"

echo "==> 1/5 downloading the JBrowse web app into $APP"
npx --yes @jbrowse/cli create jbrowse2 --force

echo "==> 2/5 downloading source data (GeneNetwork genotypes + rqtl phenotypes)"
curl -fL -o BXD.geno https://gn1.genenetwork.org/genotypes/BXD.geno
curl -fL -o bxd_pheno.csv \
  https://raw.githubusercontent.com/rqtl/qtl2data/master/BXD/bxd_pheno.csv

echo "==> 3/5 building the chromosome-painting BED (one row per strain)"
python3 "$SCRIPT_DIR/bxd_geno_to_painting_bed.py" BXD.geno bxd_painting.bed
(head -1 bxd_painting.bed; tail -n +2 bxd_painting.bed | sort -k1,1 -k2,2n) \
  | bgzip >jbrowse2/bxd_painting.bed.gz
tabix -p bed jbrowse2/bxd_painting.bed.gz

echo "==> 4/5 running the coat-color QTL scan (trait 11280, peaks at Tyrp1)"
python3 - <<'PY'
import pandas as pd
df = pd.read_csv('bxd_pheno.csv', comment='#')
df[['id', '11280']].dropna().to_csv(
    'coat_color.pheno.csv', index=False, header=['strain', 'value'])
PY
python3 "$SCRIPT_DIR/bxd_qtl_scan.py" BXD.geno coat_color.pheno.csv bxd_gwas_coatcolor.tsv
(head -1 bxd_gwas_coatcolor.tsv; tail -n +2 bxd_gwas_coatcolor.tsv | sort -k1,1 -k2,2n) \
  | bgzip >jbrowse2/bxd_gwas_coatcolor.tsv.gz
tabix -p bed jbrowse2/bxd_gwas_coatcolor.tsv.gz

echo "==> 5/5 writing config.json (mm10 from jbrowse.org, both tracks local)"
cat >jbrowse2/config.json <<'JSON'
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
      "type": "FeatureTrack",
      "trackId": "bxd_chromosome_painting_mm10",
      "name": "BXD chromosome painting (GeneNetwork)",
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
          "showTree": true,
          "height": 700
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
echo "Done. Serve the demo with:"
echo "    npx --yes serve $APP"
echo "then open the printed URL. It loads mm10 chr4 with the coat-color QTL"
echo "Manhattan over the B/D chromosome painting. Right-click the painting near"
echo "the peak and pick \"Sort rows by color here\" to reveal the B/D split."
