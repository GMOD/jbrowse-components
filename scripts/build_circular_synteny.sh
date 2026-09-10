#!/usr/bin/env bash
#
# Two genomes on one circle, the dataset behind
# website/docs/tutorials/circular_synteny.md: a UCSC liftOver chain converted
# to PAF, cut to its syntenic blocks and indexed as PIF for the ribbons, and a
# gene density bigWig for the pair (`jbrowse make-density` over both genomes'
# RefSeq curated genes) for the rings. The assemblies come from jbrowse.org's
# copies of the UCSC hubs, so nothing is built for them; a genome with no hub
# swaps that block for `jbrowse add-assembly genome.fa`.
#
# Requires: curl, gzip, awk, bgzip + tabix (htslib), bedGraphToBigWig (UCSC),
#           chain2paf (https://github.com/AndreaGuarracino/chain2paf), python3,
#           and node (the JBrowse CLI is fetched via npx unless `jbrowse` is on
#           PATH, or JBROWSE_CLI names a command to run in its place).
# Usage:    bash scripts/build_circular_synteny.sh [outdir]
#           TARGET=hg38 QUERY=mm39 bash scripts/build_circular_synteny.sh
#           CHAIN=my.over.chain.gz MIN_BLOCK=50000 bash scripts/build_circular_synteny.sh
#           BASE_URL=https://jbrowse.org/demos/circular_synteny bash scripts/build_circular_synteny.sh
#
set -euo pipefail

OUTDIR="${1:-circular_synteny_build}"
# the chain's reference genome, and the genome it lifts to
TARGET="${TARGET:-hg38}"
QUERY="${QUERY:-mm39}"
HUB="${HUB:-https://jbrowse.org/ucsc}"
Query="$(printf '%s' "${QUERY:0:1}" | tr a-z A-Z)${QUERY:1}"
CHAIN="${CHAIN:-https://hgdownload.soe.ucsc.edu/goldenPath/$TARGET/liftOver/${TARGET}To${Query}.over.chain.gz}"
TARGET_GENES="${TARGET_GENES:-$HUB/$TARGET/ncbiRefSeqCurated.gff.gz}"
QUERY_GENES="${QUERY_GENES:-$HUB/$QUERY/ncbiRefSeqCurated.gff.gz}"
# a chain row shorter than this is a repeat or a gene copy, not a block
MIN_BLOCK="${MIN_BLOCK:-100000}"
# the density bin, in bp: a whole-genome ring is megabases per pixel, and a
# bin far below that averages to a value the ring's scale cannot show
BIN="${BIN:-100000}"
# whole chromosomes to draw, resolved against both genomes
REGIONS="${REGIONS:-chr1 chr2 chr3 chr4 chr5 chr6 chr7 chr8 chr9 chr10 chr11 chr12 chr13 chr14 chr15 chr16 chr17 chr18 chr19 chrX}"
# where the finished files will be served from; empty writes bare filenames
BASE_URL="${BASE_URL:-}"

for tool in curl gzip awk bgzip tabix bedGraphToBigWig chain2paf python3 node; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: '$tool' not found on PATH" >&2
    exit 1
  }
done

if [ -n "${JBROWSE_CLI:-}" ]; then
  # shellcheck disable=SC2086
  jb() { $JBROWSE_CLI "$@"; }
elif command -v jbrowse >/dev/null 2>&1; then
  jb() { jbrowse "$@"; }
else
  jb() { npx -y @jbrowse/cli "$@"; }
fi

mkdir -p "$OUTDIR"
cd "$OUTDIR"
PAIR="${TARGET}To${Query}"

fetch() {
  [ -f "$2" ] || curl -fsSLo "$2" "$1"
}

# ── Inputs ──────────────────────────────────────────────────────────────────
fetch "$CHAIN" "$PAIR.over.chain.gz"
fetch "$HUB/$TARGET/config.json" "$TARGET.config.json"
fetch "$HUB/$QUERY/config.json" "$QUERY.config.json"
fetch "$HUB/$TARGET/$TARGET.chrom.sizes" "$TARGET.chrom.sizes"
fetch "$HUB/$QUERY/$QUERY.chrom.sizes" "$QUERY.chrom.sizes"
fetch "$HUB/$TARGET/$TARGET.chromAlias.txt" "$TARGET.hub.chromAlias.txt"
fetch "$HUB/$QUERY/$QUERY.chromAlias.txt" "$QUERY.hub.chromAlias.txt"
fetch "$TARGET_GENES" "$TARGET.genes.gff.gz"
fetch "$QUERY_GENES" "$QUERY.genes.gff.gz"

# ── The blocks ──────────────────────────────────────────────────────────────
# chain2paf writes one PAF row per chain, query first: the genome the chain
# lifts TO is the query and the chain's reference is the target. Column 11 is
# the row's aligned length with its gaps, so the filter keeps whole blocks and
# drops the tens of thousands of sub-10 kb rows a liftOver set carries. The
# circle draws a row as a ribbon between its two spans and never reads a
# CIGAR, so the cut to twelve columns is what keeps the file small enough to
# fetch whole.
[ -f "$PAIR.paf" ] || {
  gzip -dc "$PAIR.over.chain.gz" >"$PAIR.over.chain"
  chain2paf -i "$PAIR.over.chain" >"$PAIR.paf"
  rm -f "$PAIR.over.chain"
}
awk -F'\t' -v OFS='\t' -v min="$MIN_BLOCK" '$11 >= min {NF=12; print}' "$PAIR.paf" >"$PAIR.blocks.paf"
# --no-coarse: the coarse tier folds a CIGAR, and these rows carry none
[ -f "$PAIR.blocks.pif.gz" ] || jb make-pif "$PAIR.blocks.paf" --out "$PAIR.blocks.pif.gz" --no-coarse

# ── Gene density, one bigWig for the pair ───────────────────────────────────
# A ring on a two-genome circle is drawn by one track that names both
# assemblies, so both densities go into one bigWig, each contig prefixed with
# its genome ("hg38.chr1", "mm39.chr1"), and each assembly's alias table gains
# that spelling as an alias of the bare name. make-density counts a GFF3's
# top-level features per bin, so a gene is one count however many transcripts
# hang under it, and the ring reads in genes per bin.
for g in "$TARGET" "$QUERY"; do
  awk -v g="$g" -F'\t' -v OFS='\t' '/^#/ {print; next} {print $0, g "." $1}' "$g.hub.chromAlias.txt" >"$g.chromAlias.txt"
done
: >"$PAIR.chrom.sizes"
: >"$PAIR.genes.gff"
for g in "$TARGET" "$QUERY"; do
  awk -v g="$g" -F'\t' -v OFS='\t' '{print g "." $1, $2}' "$g.chrom.sizes" >>"$PAIR.chrom.sizes"
  gzip -dc "$g.genes.gff.gz" | awk -v g="$g" -F'\t' -v OFS='\t' '/^#/ {next} {$1 = g "." $1; print}' >>"$PAIR.genes.gff"
done
bgzip -f "$PAIR.genes.gff"
[ -f "$PAIR.genes.gff.density.bw" ] || jb make-density "$PAIR.genes.gff.gz" --chrom-sizes "$PAIR.chrom.sizes" --bin "$BIN"

# ── The config ──────────────────────────────────────────────────────────────
# Each assembly is its hub's entry with every relative uri made absolute; the
# RefSeq gene track comes along so a ribbon's endpoints can be opened on a
# linear view of either genome.
TARGET="$TARGET" QUERY="$QUERY" HUB="$HUB" PAIR="$PAIR" BASE_URL="$BASE_URL" REGIONS="$REGIONS" python3 - <<'PY'
import json
import os

target = os.environ['TARGET']
query = os.environ['QUERY']
hub = os.environ['HUB']
pair = os.environ['PAIR']
base = os.environ['BASE_URL']
regions = os.environ['REGIONS'].split()
uri_keys = {'uri', 'chromSizes'}


def absolutize(node, root):
    if isinstance(node, dict):
        return {
            k: f'{root}/{v}' if k in uri_keys and isinstance(v, str) and '://' not in v
            else absolutize(v, root)
            for k, v in node.items()
        }
    if isinstance(node, list):
        return [absolutize(x, root) for x in node]
    return node


def hub_parts(genome):
    config = json.load(open(f'{genome}.config.json'))
    root = f'{hub}/{genome}'
    assembly = absolutize(next(a for a in config['assemblies'] if a['name'] == genome), root)
    assembly['refNameAliases'] = {
        'adapter': {'type': 'RefNameAliasAdapter', 'uri': served(f'{genome}.chromAlias.txt')},
    }
    genes = next(t for t in config['tracks'] if t['trackId'] == f'{genome}-ncbiRefSeqCurated')
    return assembly, absolutize(genes, root)


def served(name):
    return f'{base}/{name}' if base else name


density = {
    'type': 'QuantitativeTrack',
    'trackId': f'{pair}_gene_density',
    'name': f'{target} and {query} gene density (RefSeq curated genes per 100 kb)',
    'assemblyNames': [target, query],
    'adapter': {
        'type': 'BigWigAdapter',
        'uri': served(f'{pair}.genes.gff.density.bw'),
    },
}

target_assembly, target_genes = hub_parts(target)
query_assembly, query_genes = hub_parts(query)
synteny = {
    'type': 'SyntenyTrack',
    'trackId': f'{pair}_blocks',
    'name': f'{target} vs {query} (liftOver chains of 100 kb and over)',
    'assemblyNames': [query, target],
    'adapter': {
        'type': 'PairwiseIndexedPAFAdapter',
        'uri': served(f'{pair}.blocks.pif.gz'),
        'queryAssembly': query,
        'targetAssembly': target,
    },
}
config = {
    '$schema': 'https://jbrowse.org/jb2/schema/v5/config.json',
    'assemblies': [target_assembly, query_assembly],
    'tracks': [synteny, density, target_genes, query_genes],
    'defaultSession': {
        'name': f'{target} and {query} on one circle',
        'views': [{
            'type': 'CircularView',
            'assembly': [target, query],
            'displayedRegionNames': regions,
            'height': 780,
            'tracks': [
                {'trackId': f'{pair}_gene_density', 'type': 'LinearWiggleDisplay', 'height': 40},
                f'{pair}_blocks',
            ],
        }],
    },
}
with open('config.json', 'w') as fh:
    json.dump(config, fh, indent=2)
    fh.write('\n')
print(f'wrote config.json: {target} and {query}, {len(config["tracks"])} tracks')
PY

echo "built $OUTDIR; serve it beside a JBrowse build, or deploy the files under BASE_URL"
