#!/usr/bin/env bash
#
# The gene list the build-your-own "Your own data source" example
# (products/jbrowse-build-your-own/examples-site/src/examples/InlinePlugin.tsx)
# reads from https://jbrowse.org/demos/inline_plugin/genes.json.
#
# Source: GENCODE v47's gene rows on chr17, read by tabix from jbrowse.org's
# copy of gencode.v47.chr_patch_hapl_scaff.annotation.sorted.gff3.gz. The
# output is one JSON object keyed by refName; each gene has a 0-based
# half-open start/end, strand as +1/-1, gene_name, gene_type as biotype and
# gene_id.
#
# Requires: tabix (htslib), awk.
# Usage:    bash scripts/build_inline_plugin_genes.sh [out.json]
#           scripts/deploy-demo.sh out.json inline_plugin/genes.json
#
set -euo pipefail

OUT="${1:-genes.json}"
GFF=https://jbrowse.org/genomes/GRCh38/gencode/gencode.v47.chr_patch_hapl_scaff.annotation.sorted.gff3.gz
REF=chr17

tabix -D "$GFF" "$REF" |
  awk -F'\t' -v ref="$REF" '
    $3 == "gene" {
      id = name = type = ""
      n = split($9, attrs, ";")
      for (i = 1; i <= n; i++) {
        split(attrs[i], kv, "=")
        if (kv[1] == "gene_id") id = kv[2]
        else if (kv[1] == "gene_name") name = kv[2]
        else if (kv[1] == "gene_type") type = kv[2]
      }
      printf "%s\n    {\"id\":\"%s\",\"start\":%d,\"end\":%d,\"strand\":%d,\"name\":\"%s\",\"biotype\":\"%s\"}",
        (count++ ? "," : "{\"" ref "\":["), id, $4 - 1, $5, ($7 == "-" ? -1 : 1), name, type
    }
    END { print "\n]}" }
  ' >"$OUT"

echo "wrote $OUT ($(grep -c '"id"' "$OUT") genes)"
