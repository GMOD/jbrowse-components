#!/usr/bin/env bash
#
# hg38 against a fixed list of UCSC genomes as one MultiWaySyntenyDisplay lane
# stack, from data jbrowse.org already hosts: an indexed PIF of each UCSC
# liftOver chain (ucsc/hg38/liftOver/hg38To<Genome>.over.pif.gz) and each
# genome's own hub config, whose assembly entry and best gene track are taken
# verbatim. Nothing is built or uploaded; the output is the demo config.
#
# Requires: curl, python3, tabix (for the coarse-tier report)
# Usage:    bash scripts/build_hg38_liftover_multiway.sh [config.json]
#           GENOMES="panTro6 mm39" bash scripts/build_hg38_liftover_multiway.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$REPO_ROOT/demos/hg38_vertebrates/config.json}"
GENOMES="${GENOMES:-panTro6 gorGor6 ponAbe3 rheMac10 calJac4 mm39 canFam6 bosTau9}"
HUB=https://jbrowse.org/ucsc
CACHE="${TMPDIR:-/tmp}/hg38_liftover_multiway"
mkdir -p "$CACHE" "$(dirname "$OUT")"
OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"

fetch() {
  local url=$1 file=$2
  if [ ! -f "$file" ]; then
    curl -fsS -o "$file.part" "$url"
    mv "$file.part" "$file"
  fi
}

exists() {
  [ "$(curl -s -o /dev/null -w '%{http_code}' -I "$1")" = 200 ]
}

fetch "$HUB/hg38/config.json" "$CACHE/hg38.config.json"

kept=""
echo "== probing $GENOMES"
for g in $GENOMES; do
  G="$(printf '%s' "${g:0:1}" | tr a-z A-Z)${g:1}"
  pif="$HUB/hg38/liftOver/hg38To$G.over.pif.gz"
  if ! exists "$HUB/$g/config.json"; then
    echo "-- $g: dropped, no hub config at $HUB/$g/config.json"
  elif ! exists "$pif"; then
    echo "-- $g: dropped, no liftOver PIF at $pif"
  elif ! exists "$pif.csi"; then
    echo "-- $g: dropped, no .csi beside $pif"
  else
    fetch "$HUB/$g/config.json" "$CACHE/$g.config.json"
    header=$(tabix -H "$pif" 2>/dev/null | head -1)
    coarse=$(tabix -l "$pif" 2>/dev/null | grep -c '^[TQ]' || true)
    size=$(curl -sI "$pif" | tr -d '\r' | awk 'tolower($1)=="content-length:" {print $2}')
    echo "== $g: $((size / 1048576)) MB, coarse seqids $coarse, header ${header:-none}"
    kept="$kept $g"
  fi
done

echo "== writing $OUT"
GENOMES="$kept" CACHE="$CACHE" HUB="$HUB" python3 - "$OUT" <<'PY'
import json
import math
import os
import sys

out = sys.argv[1]
genomes = os.environ['GENOMES'].split()
cache = os.environ['CACHE']
hub = os.environ['HUB']
gene_track_order = ['ncbiRefSeq', 'ncbiRefSeqCurated', 'refGene', 'augustusGene']


uri_keys = {'uri', 'chromSizes'}


def absolutize(node, base):
    if isinstance(node, dict):
        return {
            k: f'{base}/{v}' if k in uri_keys and isinstance(v, str) and '://' not in v
            else absolutize(v, base)
            for k, v in node.items()
        }
    else:
        return [absolutize(x, base) for x in node] if isinstance(node, list) else node


def hub_parts(genome):
    config = json.load(open(f'{cache}/{genome}.config.json'))
    base = f'{hub}/{genome}'
    assembly = next(a for a in config['assemblies'] if a['name'] == genome)
    by_id = {t['trackId']: t for t in config['tracks']}
    gene_id = next(
        (f'{genome}-{k}' for k in gene_track_order if f'{genome}-{k}' in by_id),
        None,
    )
    print(f'   {genome}: gene track {gene_id}')
    tracks = [absolutize(by_id[gene_id], base)] if gene_id else []
    return absolutize(assembly, base), tracks, gene_id


hg38_assembly, hg38_tracks, hg38_gene = hub_parts('hg38')
assemblies = [hg38_assembly]
tracks = list(hg38_tracks)
for g in genomes:
    assembly, gene_tracks, _ = hub_parts(g)
    assemblies.append(assembly)
    tracks.extend(gene_tracks)

lanes = 1 + len(genomes)
height = math.ceil(lanes * 22 / 10) * 10
tracks.append({
    'type': 'SyntenyTrack',
    'trackId': 'hg38_liftover_multiway',
    'name': f'hg38 vs {len(genomes)} UCSC genomes (liftOver chains)',
    'assemblyNames': ['hg38', *genomes],
    'adapter': {
        'type': 'MultiPairwiseSyntenyAdapter',
        'adapters': [{
            'type': 'PairwiseIndexedPAFAdapter',
            'uri': f'{hub}/hg38/liftOver/hg38To{g[0].upper()}{g[1:]}.over.pif.gz',
            'csi': True,
            'assemblyNames': [g, 'hg38'],
        } for g in genomes],
    },
    'displays': [{
        'type': 'MultiWaySyntenyDisplay',
        'displayId': 'hg38_liftover_multiway-MultiWaySyntenyDisplay',
        'height': height,
    }],
})
config = {
    'assemblies': assemblies,
    'tracks': tracks,
    'defaultSession': {
        'name': 'hg38 vs UCSC genomes',
        'views': [{
            'type': 'LinearGenomeView',
            'assembly': 'hg38',
            'loc': 'chr17:7,400,000-7,700,000',
            'tracks': [*([hg38_gene] if hg38_gene else []), 'hg38_liftover_multiway'],
        }],
    },
}
with open(out, 'w') as fh:
    json.dump(config, fh, indent=2)
    fh.write('\n')
print(f'   {len(assemblies)} assemblies, {len(tracks)} tracks, {lanes} lanes, display height {height}')
PY
(cd "$REPO_ROOT" && pnpm exec oxfmt "$OUT" >/dev/null 2>&1) || true
