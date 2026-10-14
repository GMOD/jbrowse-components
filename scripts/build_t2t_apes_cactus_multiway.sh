#!/usr/bin/env bash
#
# Stack the T2T apes under hg38 from one Cactus alignment, each lane joined to
# the lane above it by the alignment between those two genomes.
#
# The Cactus team publishes a chain for every pair of genomes in its 8-way
# T2T ape alignment (Yoo et al. 2025), all cut from one multiple alignment. The
# track takes two kinds of pair from it:
#
# - hg38 against each ape, which places each lane under the human window
# - each ape against the next one down the tree, which draws the ribbons
#
# No pair file names one assembly in every row, so MultiGenomeIndexedPAFAdapter
# declares no star anchor and the display asks the file for each adjacent lane
# pair, drawing chimp against bonobo rather than each against hg38.
#
# Each lane's assembly and gene track are the genome's own GenArk hub on
# genomes.jbrowse.org, as on the gene-symbol primate page. The chains name
# contigs by GenBank accession (CM054434.2), which the hub's chromAlias maps.
#
# Requires: curl, chain2paf (github.com/AndreaGuarracino/chain2paf), jbrowse
#           (@jbrowse/cli), python3
# Usage:    bash build_t2t_apes_cactus_multiway.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-t2t_apes_cactus_build}"
CHAINS=https://cgl.gi.ucsc.edu/data/cactus/t2t-apes/8-t2t-apes-2023v2/chains

# Lane order, top to bottom: the genome's name in the Cactus alignment, the
# hub it loads from (also its PanSN sample in the PAF), the lane label. The
# siamang hub is v2.1, which only swapped the chr12 and chr19 labels of the
# v2.0 sequences Cactus aligned, so every contig resolves at the same length.
read -r -d '' SPECIES <<'TABLE' || true
hg38             hg38             Human (GRCh38)
GCA_028858775.2  GCF_028858775.2  Chimpanzee (NHGRI_mPanTro3)
GCA_029289425.2  GCF_029289425.2  Bonobo (NHGRI_mPanPan1)
GCA_029281585.2  GCF_029281585.2  Gorilla (NHGRI_mGorGor1)
GCA_028885655.2  GCF_028885655.2  Sumatran orangutan (NHGRI_mPonAbe1)
GCA_028885625.2  GCF_028885625.2  Bornean orangutan (NHGRI_mPonPyg2)
GCA_028878055.2  GCF_028878055.3  Siamang (NHGRI_mSymSyn1)
TABLE

mkdir -p "$OUTDIR"
cd "$OUTDIR"
echo "$SPECIES" > species.tsv

# ── The hub each lane is taken from ──────────────────────────────────────────
mkdir -p hubs
while read -r _ hub _; do
  case "$hub" in
    GC[AF]_*) base="https://jbrowse.org/hubs/genark/${hub:0:3}/${hub:4:3}/${hub:7:3}/${hub:10:3}/$hub" ;;
    *) base="https://jbrowse.org/ucsc/$hub" ;;
  esac
  echo "$base" > "hubs/$hub.base"
  [ -s "hubs/$hub.config.json" ] || curl -fsS -o "hubs/$hub.config.json" "$base/config.json"
done < species.tsv

# ── The pairs: hg38 against every ape, then each ape against the next ────────
# A file A_vs_B holds A as each chain's target and B as its query.
mapfile -t CACTUS < <(awk '{print $1}' species.tsv)
PAIRS=()
for g in "${CACTUS[@]:1}"; do PAIRS+=("hg38 $g"); done
for i in $(seq 1 $((${#CACTUS[@]} - 2))); do
  PAIRS+=("${CACTUS[$i]} ${CACTUS[$((i + 1))]}")
done

hub_of() { awk -v g="$1" '$1 == g { print $2 }' species.tsv; }

mkdir -p chains
: > apes.paf.tmp
for pair in "${PAIRS[@]}"; do
  read -r target query <<< "$pair"
  file="${target}_vs_${query}.chain.gz"
  [ -s "chains/$file" ] || curl -fsS -o "chains/$file" "$CHAINS/$file"
  gzip -dc "chains/$file" > chains/pair.chain
  # PanSN names (sample#haplotype#contig) say which genome each side is
  chain2paf -i chains/pair.chain \
    | awk -F'\t' -v q="$(hub_of "$query")" -v t="$(hub_of "$target")" \
        'BEGIN { OFS = "\t" } { $1 = q "#0#" $1; $6 = t "#0#" $6; print }' \
    >> apes.paf.tmp
  echo "converted $target vs $query"
done
rm chains/pair.chain
mv apes.paf.tmp apes.paf

jbrowse make-pif apes.paf --out apes.pif.gz

# ── The JBrowse config ───────────────────────────────────────────────────────
python3 - <<'PY'
import json

species = []
with open('species.tsv') as fh:
    for line in fh:
        _, hub, label = line.rstrip('\n').split(None, 2)
        species.append((hub, label))

uri_keys = {'uri', 'chromSizes'}
gene_track_order = ['ncbiRefSeq', 'ncbiRefSeqCurated', 'refGene']


def absolutize(node, base):
    if isinstance(node, dict):
        return {
            k: f'{base}/{v}' if k in uri_keys and isinstance(v, str) and '://' not in v
            else v if k == 'metadata'
            else absolutize(v, base)
            for k, v in node.items()
        }
    return [absolutize(x, base) for x in node] if isinstance(node, list) else node


def hub_parts(hub, label):
    config = json.load(open(f'hubs/{hub}.config.json'))
    base = open(f'hubs/{hub}.base').read().strip()
    assembly = next(a for a in config['assemblies'] if a['name'] == hub)
    by_id = {t['trackId']: t for t in config['tracks']}
    gene_id = next(f'{hub}-{k}' for k in gene_track_order if f'{hub}-{k}' in by_id)
    assembly = {**absolutize(assembly, base), 'displayName': label}
    return assembly, absolutize(by_id[gene_id], base)


parts = [hub_parts(hub, label) for hub, label in species]
order = [hub for hub, _ in species]
config = {
    '$schema': 'https://jbrowse.org/jb2/schema/v5/config.json',
    'assemblies': [assembly for assembly, _ in parts],
    'tracks': [track for _, track in parts] + [{
        'type': 'SyntenyTrack',
        'trackId': 't2t_apes_cactus',
        'name': 'T2T apes (Cactus alignment)',
        'assemblyNames': order,
        'adapter': {
            'type': 'MultiGenomeIndexedPAFAdapter',
            'uri': 'apes.pif.gz',
            'assemblyNames': order,
        },
        # The lanes stack down the tree, so each ribbon joins two genomes
        # whose pair the file holds.
        'displays': [{
            'type': 'MultiWaySyntenyDisplay',
            'displayId': 't2t_apes_cactus-MultiWaySyntenyDisplay',
            'rows': {'domain': order[1:]},
        }],
    }],
    'defaultSession': {
        'name': 'T2T apes, Cactus alignment',
        'views': [{
            'type': 'LinearGenomeView',
            'assembly': order[0],
            'loc': 'chr17:7,400,000-7,700,000',
            'tracks': [f'{order[0]}-ncbiRefSeq', 't2t_apes_cactus'],
        }],
    },
}
with open('config.json', 'w') as fh:
    fh.write(json.dumps(config, indent=2) + '\n')
PY

cat <<EOF

built in $OUTDIR:
  config.json        $(wc -l < species.tsv) hub assemblies, their gene tracks and the Cactus track
  apes.pif.gz{,.tbi} ${#PAIRS[@]} Cactus pairs as one indexed multi-genome PAF

serve this directory and open config.json.
EOF
