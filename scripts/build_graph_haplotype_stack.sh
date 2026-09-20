#!/usr/bin/env bash
#
# A stack of assembled haplotypes read out of the HPRC graph, each aligned base
# by base to the row under it, for a linear synteny view. The default is the C4
# locus: two haplotypes with three C4 modules, GRCh38 with two, a haplotype
# whose second module lacks the HERV-K insertion, and a haplotype with one.
#
# One range-requested window of the graph database holds every row's walk and
# the node sequences. Two walks through one node are the same bases, so each
# adjacent pair's alignment is read off the walks with no aligner, and a band
# between two haplotypes covers what they share and GRCh38 lacks.
#
# Requires: curl, python3, and Node.js for `npx`
# Usage:    REGION=chr6:31940000-32090000 ROWS='HG01978#2 HG02004#2 GRCh38#0 HG02818#1 HG00146#1' \
#             bash build_graph_haplotype_stack.sh [outdir]
#
# REGION is on GRCh38 and ROWS is the stack from the top, PanSN sample#haplotype
# names, GRCh38#0 for the reference itself. Any of the release 2 haplotypes
# works: jbrowse.org/pangenome/hprc-grch38 hosts an assembly and CAT genes for
# each. For another graph, point GBZ_DB and GBZ_INDEX at a database built by
# build_hprc_gbz_index.sh and replace the config step's assemblies.

set -euo pipefail

OUT="${1:-graph_haplotype_stack}"
REGION="${REGION:-chr6:31940000-32090000}"
ROWS="${ROWS:-HG01978#2 HG02004#2 GRCh38#0 HG02818#1 HG00146#1}"
MAX_GAP="${MAX_GAP:-200000}"
GBZ_DB="${GBZ_DB:-https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db}"
GBZ_INDEX="${GBZ_INDEX:-https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db}"
HOSTED=https://jbrowse.org/pangenome/hprc-grch38

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELPERS=(gfa_to_pairwise_paf.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

mkdir -p "$OUT"
cd "$OUT"

echo "== the window of the graph, with each row's walk"
contig="${REGION%%:*}"
range="${REGION##*:}"
keep=()
for row in $ROWS; do
  [ "$row" = "GRCh38#0" ] || keep+=(--keep "$row")
done
[ -s window.gfa ] || npx --yes -p @gmod/gbz-base gbz-base-query "$GBZ_DB" \
  --haplotype-index "$GBZ_INDEX" --sample GRCh38 --contig "$contig" \
  --interval "${range%-*}..${range#*-}" --context 0 --format gfa "${keep[@]}" >window.gfa

echo "== whole-contig lengths"
: >contig_lengths.tsv
for row in $ROWS; do
  if [ "$row" = "GRCh38#0" ]; then
    curl -fsSL https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chrom.sizes
  else
    curl -fsSL "$HOSTED/${row/\#/.}.chrom.sizes"
  fi | awk -F'\t' -v OFS='\t' -v p="$row" '{print p "#" $1, $2}' >>contig_lengths.tsv
done

echo "== each row against the row under it"
: >adjacent.paf
upper=""
for row in $ROWS; do
  if [ -n "$upper" ]; then
    # --compare-bases aligns what lies between two shared nodes base by base
    # --max-gap keeps a module-sized indel inside one record, where the view
    #   draws it from the CIGAR
    python3 "$SCRIPT_DIR/gfa_to_pairwise_paf.py" window.gfa --reference "$row" --queries "$upper" \
      --hold-queries --compare-bases --max-gap "$MAX_GAP" --contig-lengths contig_lengths.tsv >>adjacent.paf
  fi
  upper="$row"
done

echo "== config.json and session.json"
ROWS="$ROWS" HOSTED="$HOSTED" python3 - <<'PY'
import json
import os

hosted = os.environ['HOSTED']
rows = os.environ['ROWS'].split()
assembly = {row: 'hg38' if row == 'GRCh38#0' else row.replace('#', '.') for row in rows}
names = [assembly[row] for row in rows]

spans = {}
for line in open('window.gfa'):
    if line.startswith('W\t'):
        _, sample, hap, contig, start, end, _ = line.split('\t', 6)
        row = f'{sample}#{hap}'
        if row not in spans or int(end) - int(start) > spans[row][2] - spans[row][1]:
            spans[row] = (contig, int(start), int(end))


def gene_track_id(name):
    return 'hg38_ncbiRefSeq_ucsc' if name == 'hg38' else f"hprc_genes_{name.replace('.', '_')}"


def haplotype(name):
    return {
        'name': name,
        'sequence': {
            'type': 'ReferenceSequenceTrack',
            'trackId': f'{name}-ReferenceSequenceTrack',
            'adapter': {'type': 'ChromSizesAdapter', 'uri': f'{hosted}/{name}.chrom.sizes'},
        },
    }


def genes(name):
    return {
        'type': 'FeatureTrack',
        'trackId': gene_track_id(name),
        'name': f'{name} genes (HPRC release 2 CAT annotation)',
        'assemblyNames': [name],
        'adapter': {'type': 'BedTabixAdapter', 'uri': f'{hosted}/genes/{name}.genes.bed.gz'},
    }


config = {
    '$schema': 'https://jbrowse.org/jb2/schema/v5/config.json',
    'assemblies': [
        {
            'name': 'hg38',
            'aliases': ['GRCh38'],
            'uri': 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
            'refNameAliases': {'uri': 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt'},
        },
        *[haplotype(name) for name in names if name != 'hg38'],
    ],
    'tracks': [
        {
            'type': 'FeatureTrack',
            'trackId': 'hg38_ncbiRefSeq_ucsc',
            'name': 'NCBI RefSeq genes (hg38)',
            'assemblyNames': ['hg38'],
            'adapter': {
                'type': 'Gff3TabixAdapter',
                'uri': 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz',
                'csi': True,
            },
        },
        *[genes(name) for name in names if name != 'hg38'],
        {
            'type': 'SyntenyTrack',
            'trackId': 'graph_adjacent',
            'name': 'Each haplotype against the next, read off the HPRC graph',
            'assemblyNames': names,
            'adapter': {
                'type': 'MultiGenomePAFAdapter',
                'uri': 'adjacent.paf',
                'assemblyNames': names,
                'assemblyNameToPanSN': {assembly[row]: row for row in rows},
            },
        },
    ],
}
session = {
    'views': [
        {
            'type': 'LinearSyntenyView',
            'views': [
                {
                    'assembly': assembly[row],
                    'loc': f'{spans[row][0]}:{spans[row][1] + 1}-{spans[row][2]}',
                    'tracks': [gene_track_id(assembly[row])],
                }
                for row in rows
            ],
            'tracks': [['graph_adjacent'] for _ in rows[1:]],
            'colorBy': {'field': 'strand'},
            'drawCurves': True,
        }
    ]
}
for path, value in (('config.json', config), ('session.json', session)):
    with open(path, 'w') as fh:
        json.dump(value, fh, indent=2)
        fh.write('\n')
PY

echo "Wrote $(pwd)/window.gfa, adjacent.paf, config.json and session.json"
