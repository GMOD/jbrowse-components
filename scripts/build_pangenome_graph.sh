#!/usr/bin/env bash
#
# One command from a pangenome graph to what JBrowse's graph track reads: the
# segment and link indexes a window is cut from, the bubble file, the coarse
# tier a whole chromosome draws from, the allele inventory, and a config that
# puts them on one graph track with the tier beside it.
#
# Requires: bgzip, tabix, sort, python3; gfatools and gawk (as `awk`) for an
#           rGFA; a `vg deconstruct` snarl VCF for a plain GFA's bubbles
# Usage:    bash scripts/build_pangenome_graph.sh <graph.gfa[.gz]> <out-prefix> \
#             [--reference SAMPLE] [--assembly NAME] [--snarls snarls.vcf.gz] [--tier N]
#
# An rGFA (minigraph, or the minigraph stage of Minigraph-Cactus) states each
# segment's place on the reference in its SN/SO/SR tags. A plain GFA (pggb,
# odgi, vg, base-level Minigraph-Cactus) states the same thing in its P or W
# lines, and needs --reference to say which sample is the backbone; without it
# file order picks, and the walk says so on stderr. `gfatools bubble` places a
# bubble by rGFA tags, so a plain GFA gets its bubbles from --snarls instead.
#
# Produces, beside <out-prefix>:
#   .segs.bed.gz .links.bed.gz     one row per segment, one per link endpoint
#   .bubbles.bed.gz                where the graph varies
#   .tier<N>.segs/links.bed.gz     one node per bubble with content over N bp
#   .alleles.bed.gz                what the variation is, one CIGAR per allele
#   .config.json                   the tracks, ready to merge into a config
#
# --assembly is the name your JBrowse config gives the reference; the graph
# track maps it onto the graph's own PanSN sample. --tier is the bubble
# content, in bp, below which a bubble joins the backbone in the tier: 10000 for
# an SV-resolution graph, 50 for a base-level one, which is what the builder
# used on HPRC and on the five-strain E. coli pggb graph.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

HELPERS=(build_rgfa_tabix.sh build_pggb_tabix.sh pggb_gfa_to_bed.py
  build_bubble_tier.sh bubbles_to_tier_bed.py build_rgfa_alleles.sh
  snarls_to_bubble_bed.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

usage() {
  sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 1
}

GRAPH="${1:-}"
PREFIX="${2:-}"
[ -n "$GRAPH" ] && [ -n "$PREFIX" ] || usage
shift 2
REFERENCE=""
ASSEMBLY=""
SNARLS=""
TIER=""
while [ $# -gt 0 ]; do
  case "$1" in
    --reference) REFERENCE="$2"; shift 2 ;;
    --assembly) ASSEMBLY="$2"; shift 2 ;;
    --snarls) SNARLS="$2"; shift 2 ;;
    --tier) TIER="$2"; shift 2 ;;
    *) echo "unknown option $1" >&2; usage ;;
  esac
done
[ -s "$GRAPH" ] || { echo "no such graph: $GRAPH" >&2; exit 1; }

export LC_ALL=C

gfa() {
  case "$GRAPH" in
    *.gz) gzip -dc "$GRAPH" ;;
    *.zst) zstd -dc "$GRAPH" ;;
    *) cat "$GRAPH" ;;
  esac
}

# rGFA when the first segment carries the SN tag; nothing else tells the two
# apart. `|| true` because awk stops reading at that line, and the decompressor
# it cuts off would otherwise fail the pipeline under pipefail.
FIRST_SEGMENT="$(gfa 2>/dev/null | awk '/^S/ { print; exit }' || true)"
case "$FIRST_SEGMENT" in
  *$'\tSN:Z:'*) ROUTE=rgfa ;;
  *) ROUTE=paths ;;
esac
echo "== $ROUTE graph: $GRAPH"

case "$ROUTE" in
  rgfa)
    bash "$SCRIPT_DIR/build_rgfa_tabix.sh" "$GRAPH" "$PREFIX"
    echo "== $PREFIX.bubbles.bed.gz"
    gfa | gfatools bubble - | sort -k1,1 -k2,2n | bgzip > "$PREFIX.bubbles.bed.gz"
    tabix -f -p bed "$PREFIX.bubbles.bed.gz"
    ;;
  paths)
    bash "$SCRIPT_DIR/build_pggb_tabix.sh" "$GRAPH" "$PREFIX" ${REFERENCE:+"$REFERENCE"}
    if [ -n "$SNARLS" ]; then
      echo "== $PREFIX.bubbles.bed.gz, from the snarl VCF"
      python3 "$SCRIPT_DIR/snarls_to_bubble_bed.py" "$SNARLS" "$PREFIX.bubbles.bed"
      sort -k1,1 -k2,2n "$PREFIX.bubbles.bed" | bgzip > "$PREFIX.bubbles.bed.gz"
      rm -f "$PREFIX.bubbles.bed"
      tabix -f -p bed "$PREFIX.bubbles.bed.gz"
    else
      echo "== no --snarls given, so no bubble file, tier or bubble tracks for this graph" >&2
    fi
    ;;
esac

# The reference's PanSN sample is the stable name of the first rank-0 segment;
# a bare name (chr) is a graph with no sample half, which needs no mapping.
SAMPLE="$(gzip -dc "$PREFIX.segs.bed.gz" | awk -F'\t' '$5 == 0 && !s { s = $1 } END { n = split(s, p, "#"); if (n >= 3) print p[1] }')"
[ -n "$ASSEMBLY" ] || ASSEMBLY="${SAMPLE:-reference}"

if [ -z "$TIER" ]; then
  [ "$ROUTE" = rgfa ] && TIER=10000 || TIER=50
fi
if [ -s "$PREFIX.bubbles.bed.gz" ]; then
  bash "$SCRIPT_DIR/build_bubble_tier.sh" "$PREFIX.bubbles.bed.gz" "$PREFIX.tier$TIER" "$TIER"
fi

bash "$SCRIPT_DIR/build_rgfa_alleles.sh" "$PREFIX"

# A node draws about ten pixels wide at the zoom the fine tier hands over to
# the coarse one, so the handover is the mean backbone segment length over ten
# bp per pixel: about 1,000 for HPRC's minigraph graph, under 2 for a pggb one.
ABOVE_BP_PER_PX="$(gzip -dc "$PREFIX.segs.bed.gz" | awk -F'\t' '$5 == 0 { bp += $3 - $2; n++ } END { v = n ? bp / n / 10 : 100; if (v < 1) v = 1; printf "%d", v }')"

echo "== $PREFIX.config.json"
PREFIX="$PREFIX" ASSEMBLY="$ASSEMBLY" SAMPLE="$SAMPLE" TIER="$TIER" ABOVE="$ABOVE_BP_PER_PX" python3 - <<'PY'
import json
import os

prefix = os.environ['PREFIX']
assembly = os.environ['ASSEMBLY']
sample = os.environ['SAMPLE']
tier = os.environ['TIER']
above = int(os.environ['ABOVE'])
base = os.path.basename(prefix)
stem = base.replace('.', '_').replace('-', '_')
have_bubbles = os.path.exists(f'{prefix}.bubbles.bed.gz')
pansn = {'assemblyNameToPanSN': {assembly: sample}} if sample and sample != assembly else {}

tracks = [
    {
        'type': 'FeatureTrack',
        'trackId': f'{stem}_graph',
        'name': f'{base} graph',
        'assemblyNames': [assembly],
        'adapter': {
            'type': 'RgfaTabixAdapter',
            'uri': base,
            **pansn,
            **(
                {'coarse': {'uri': f'{base}.tier{tier}', 'aboveBpPerPx': above}}
                if have_bubbles
                else {}
            ),
        },
        'displayDefaults': {'showLabels': 'none'},
    },
    {
        'type': 'AlignmentsTrack',
        'trackId': f'{stem}_alleles',
        'name': f'{base} alleles',
        'assemblyNames': [assembly],
        'adapter': {'type': 'BedTabixAdapter', 'uri': f'{base}.alleles.bed.gz'},
    },
]
if have_bubbles:
    bubbles = {
        'type': 'MinigraphBubbleAdapter',
        'uri': f'{base}.bubbles.bed.gz',
        **pansn,
    }
    tracks += [
        {
            'type': 'FeatureTrack',
            'trackId': f'{stem}_bubbles',
            'name': f'{base} bubbles',
            'assemblyNames': [assembly],
            'adapter': bubbles,
        },
        {
            'type': 'QuantitativeTrack',
            'trackId': f'{stem}_bubble_score',
            'name': f'{base} segments per bubble',
            'assemblyNames': [assembly],
            'adapter': bubbles,
        },
    ]

config = {
    '$schema': 'https://jbrowse.org/jb2/schema/v5/config.json',
    'plugins': [
        {
            'name': 'GraphGenomeView',
            'esmUrl': 'https://jbrowse.org/plugins/jbrowse-plugin-graphgenomeviewer/latest/dist/jbrowse-plugin-graphgenomeviewer.esm.js',
        }
    ],
    'tracks': tracks,
}
with open(f'{prefix}.config.json', 'w') as fh:
    json.dump(config, fh, indent=2)
    fh.write('\n')
print(f'{len(tracks)} tracks on assembly {assembly!r}' + (f', graph sample {sample!r}' if sample else ''))
PY

ls -l "$PREFIX".*.bed.gz "$PREFIX.config.json"
