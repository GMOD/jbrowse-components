#!/usr/bin/env bash
#
# Two genomes on one circle from their FASTAs alone, for a pair with no hosted
# chain: minimap2 aligns the second genome to the first, `jbrowse make-pif`
# indexes the PAF, and the config draws each alignment as a ribbon on a
# CircularView. scripts/build_circular_synteny.sh is the hosted-hub version.
#
# Each sequence is renamed from its FASTA header the way NCBI writes them:
# "chromosome A01," names A01, "chromosome 1" names Chr1, "plasmid pCD1" names
# pCD1, and a lone "complete sequence" or "complete genome" names chromosome.
# Organelles and unplaced scaffolds are left out.
#
# Requires: curl, python3, bgzip and samtools (htslib), minimap2, and node (the
#           JBrowse CLI is fetched via npx unless `jbrowse` is on PATH, or
#           JBROWSE_CLI names a command to run in its place).
# Usage:    NAME1=CO92 FASTA1=<url or path> NAME2=KIM FASTA2=<url or path> \
#             bash scripts/build_circular_synteny_fasta.sh [outdir]
#           PRESET=asm20 MIN_LENGTH=2000 BASE_URL=https://example.org/pair ...
#           COLORS1="#1f77b4 #ff7f0e #2ca02c" COLOR_FIELD=strand ...
#           LABEL1="Yersinia pestis CO92" LABEL2="Yersinia pestis KIM" ...
#
set -euo pipefail

OUTDIR="${1:-circular_synteny_fasta_build}"
: "${NAME1:?NAME1 names the first genome}"
: "${FASTA1:?FASTA1 is the FASTA of the first genome, a URL or a path}"
: "${NAME2:?NAME2 names the second genome}"
: "${FASTA2:?FASTA2 is the FASTA of the second genome, a URL or a path}"
# minimap2's assembly preset: asm5 for strains of one species, asm10 or asm20
# as the pair diverges
PRESET="${PRESET:-asm5}"
# the view's length filter: an alignment shorter than this is left off the
# circle, as a repeat or a gene copy rather than a block
MIN_LENGTH="${MIN_LENGTH:-0}"
THREADS="${THREADS:-4}"
# each genome's name on the circle and in the assembly menus
LABEL1="${LABEL1:-$NAME1}"
LABEL2="${LABEL2:-$NAME2}"
# each genome's chromosome colors in order, which the ribbons and the second
# genome's painted ideogram read; empty keeps the default palette
COLORS1="${COLORS1:-}"
COLORS2="${COLORS2:-}"
# what the ribbons' color says: empty colors by the first genome's chromosomes,
# strand suits a pair of one chromosome each
COLOR_FIELD="${COLOR_FIELD:-}"
# where the finished files will be served from; empty writes bare filenames
BASE_URL="${BASE_URL:-}"

for tool in curl python3 bgzip samtools minimap2 node; do
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

fetch() {
  case "$1" in
  *://*) [ -f "$2" ] || curl -fsSLo "$2" "$1" ;;
  *) [ -f "$2" ] || cp "$1" "$2" ;;
  esac
}

rename() {
  python3 - "$1" "$2" <<'PY'
import gzip
import re
import sys

source, out = sys.argv[1], sys.argv[2]
opener = gzip.open if source.endswith('.gz') else open


def name_of(header):
    if re.search(r'mitochondri|chloroplast|plastid|unplaced|unlocalized|scaffold', header):
        return None
    m = re.search(r'chromosome (\w+)', header)
    if m:
        return f'Chr{m[1]}' if m[1].isdigit() else m[1]
    m = re.search(r'plasmid (\S+?),', header)
    if m:
        return m[1]
    if re.search(r'complete (sequence|genome)', header):
        return 'chromosome'
    return None


keep = False
with opener(source, 'rt') as fh, open(out, 'w') as o:
    for line in fh:
        if line.startswith('>'):
            name = name_of(line)
            keep = name is not None
            if keep:
                o.write(f'>{name}\n')
        elif keep:
            o.write(line)
PY
}

for i in 1 2; do
  name_var="NAME$i"
  fasta_var="FASTA$i"
  name="${!name_var}"
  fetch "${!fasta_var}" "$name.source.fa.gz"
  [ -f "$name.fa.gz.fai" ] || {
    rename "$name.source.fa.gz" "$name.fa"
    bgzip -f "$name.fa"
    samtools faidx "$name.fa.gz"
  }
  cut -f1,2 "$name.fa.gz.fai"
done

PAIR="${NAME2}_to_${NAME1}"
[ -f "$PAIR.paf" ] || minimap2 -c -x "$PRESET" -t "$THREADS" "$NAME1.fa.gz" "$NAME2.fa.gz" >"$PAIR.paf"
[ -f "$PAIR.pif.gz" ] || jb make-pif "$PAIR.paf" --csi --out "$PAIR.pif.gz"

NAME1="$NAME1" NAME2="$NAME2" PAIR="$PAIR" MIN_LENGTH="$MIN_LENGTH" BASE_URL="$BASE_URL" COLORS1="$COLORS1" COLORS2="$COLORS2" COLOR_FIELD="$COLOR_FIELD" LABEL1="$LABEL1" LABEL2="$LABEL2" python3 - <<'PY'
import json
import os

first = os.environ['NAME1']
second = os.environ['NAME2']
pair = os.environ['PAIR']
min_length = int(os.environ['MIN_LENGTH'])
base = os.environ['BASE_URL']
colors = {first: os.environ['COLORS1'].split(), second: os.environ['COLORS2'].split()}
color_field = os.environ['COLOR_FIELD']
labels = {first: os.environ['LABEL1'], second: os.environ['LABEL2']}


def served(name):
    return f'{base}/{name}' if base else name


def assembly(name):
    conf = {
        'name': name,
        'displayName': labels[name],
        'sequence': {
            'type': 'ReferenceSequenceTrack',
            'trackId': f'{name}-refseq',
            'adapter': {'type': 'BgzipFastaAdapter', 'uri': served(f'{name}.fa.gz')},
        },
    }
    if colors[name]:
        conf['refNameColors'] = colors[name]
    return conf


view = {
    'type': 'CircularView',
    'assembly': [first, second],
    'height': 780,
    'tracks': [pair],
}
if min_length:
    view['minAlignmentLength'] = min_length
if color_field:
    view['color'] = {'field': color_field}
config = {
    '$schema': 'https://jbrowse.org/jb2/schema/v5/config.json',
    'assemblies': [assembly(first), assembly(second)],
    'tracks': [{
        'type': 'SyntenyTrack',
        'trackId': pair,
        'name': f'{second} aligned to {first}',
        'assemblyNames': [second, first],
        'adapter': {
            'type': 'PairwiseIndexedPAFAdapter',
            'uri': served(f'{pair}.pif.gz'),
            'csi': True,
            'queryAssembly': second,
            'targetAssembly': first,
        },
    }],
    'defaultSession': {'name': f'{first} and {second} on one circle', 'views': [view]},
}
with open('config.json', 'w') as fh:
    json.dump(config, fh, indent=2)
    fh.write('\n')
print(f'wrote config.json: {first} and {second}')
PY

echo "built $OUTDIR; serve it beside a JBrowse build, or deploy the files under BASE_URL"
