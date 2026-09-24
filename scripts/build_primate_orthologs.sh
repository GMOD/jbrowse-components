#!/usr/bin/env bash
#
# Stack eight primate genomes as lanes of one MultiWaySyntenyDisplay, from
# their RefSeq annotations alone.
#
# NCBI's annotation pipeline names a gene by its ortholog across species (human
# ATP5F1A is chimp ATP5F1A), so an ortholog table is a join on the gene symbol,
# which symbols_to_blocks.py does over the GFF3 files in a few seconds. The
# download is the GFF3 and the sequence report per genome, ~290 MB for eight.
# The same route with a PGAP bacterial annotation is `--unnamed '_RS[0-9]+$'` on
# the helper. In either kingdom the join reaches as far as the naming: a gene
# family whose copies got LOC ids (the AMY1 cluster here) and the accessory
# genome of a pangenome both stay unjoined.
#
# Each lane's assembly and gene track are the genome's own hub on
# genomes.jbrowse.org, taken verbatim: a RefSeq-annotated genome is a GenArk hub
# there under its accession, with its 2bit, chromAlias and NCBI RefSeq genes.
# Human is the exception, because UCSC serves GRCh38 as hg38 rather than as a
# GenArk hub, and the hg38 hub's chromAlias resolves the NC_ names the BEDs use.
#
# The genomes are the NHGRI T2T apes (v2.1 primary haplotypes), T2T macaque
# and GRCh38.p14, all reference assemblies with a current RefSeq annotation.
# Human is first because the table is anchored on it: every row is one human
# gene and the other columns are that gene's ortholog.
#
# Requires: the NCBI `datasets` CLI, curl, unzip, python3
# Usage:    bash build_primate_orthologs.sh [outdir]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(symbols_to_blocks.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUTDIR="${1:-primate_orthologs_build}"

# name, RefSeq accession, hub, label the lane header and track list show
read -r -d '' SPECIES <<'TABLE' || true
human     GCF_000001405.40  hg38             Human (GRCh38.p14)
chimp     GCF_028858775.2   GCF_028858775.2  Chimpanzee (NHGRI_mPanTro3-v2.1)
bonobo    GCF_029289425.2   GCF_029289425.2  Bonobo (NHGRI_mPanPan1-v2.1)
gorilla   GCF_029281585.2   GCF_029281585.2  Gorilla (NHGRI_mGorGor1-v2.1)
sumatran  GCF_028885655.2   GCF_028885655.2  Sumatran orangutan (NHGRI_mPonAbe1-v2.1)
bornean   GCF_028885625.2   GCF_028885625.2  Bornean orangutan (NHGRI_mPonPyg2-v2.1)
siamang   GCF_028878055.3   GCF_028878055.3  Siamang (NHGRI_mSymSyn1-v2.1)
macaque   GCF_049350105.2   GCF_049350105.2  Rhesus macaque (T2T-MMU8v2.0)
TABLE

mkdir -p "$OUTDIR"
cd "$OUTDIR"
echo "$SPECIES" > species.tsv
ANCHOR=$(head -1 species.tsv | awk '{print $1}')
NAMES=$(awk '{print $1}' species.tsv)

# ── The hub each lane is taken from ──────────────────────────────────────────
# hg38 is a UCSC hub at jbrowse.org/ucsc/<db>; a GenArk hub's path is its
# accession cut into GCF/000/001/405/<accession>.
mkdir -p hubs
while read -r _ _ hub _; do
  case "$hub" in
    GC[AF]_*) base="https://jbrowse.org/hubs/genark/${hub:0:3}/${hub:4:3}/${hub:7:3}/${hub:10:3}/$hub" ;;
    *) base="https://jbrowse.org/ucsc/$hub" ;;
  esac
  echo "$base" > "hubs/$hub.base"
  [ -s "hubs/$hub.config.json" ] || curl -fsS -o "hubs/$hub.config.json" "$base/config.json"
done < species.tsv

# ── GFF3 and sequence report per genome, in one archive ──────────────────────
mkdir -p ncbi
awk '{print $2}' species.tsv > ncbi/accessions.txt
if [ ! -f ncbi/genomes.zip ]; then
  datasets download genome accession --inputfile ncbi/accessions.txt \
    --include gff3,seq-report --filename ncbi/genomes.zip --no-progressbar
fi
if [ ! -d ncbi/extract/ncbi_dataset/data ]; then
  unzip -q -o ncbi/genomes.zip -d ncbi/extract
fi
DATA=ncbi/extract/ncbi_dataset/data

# ── Per genome: the GFF3 on its assembled chromosomes ────────────────────────
# The sequence report names every sequence and its role. Genes on anything but
# an assembled chromosome are dropped, so an unplaced scaffold's genes never get
# a lane placed on it.
while read -r name acc _; do
  if [ -s "$name.gff.gz" ]; then
    echo "reusing $name"
    continue
  fi
  python3 - "$DATA/$acc/sequence_report.jsonl" "$name.chromosomes" <<'PY'
import json, sys
report, out = sys.argv[1:]
with open(report) as fh, open(out, 'w') as chroms:
    for line in fh:
        r = json.loads(line)
        if r.get('role') == 'assembled-molecule' and r.get('assignedMoleculeLocationType') == 'Chromosome' and r.get('refseqAccession'):
            chroms.write(f"{r['refseqAccession']}\n")
PY
  # Sorted so the table's rows come out in genome order. -t is not optional:
  # GFF3 attribute columns contain spaces.
  awk 'NR == FNR { keep[$1] = 1; next } /^#/ { next } ($1 in keep)' \
    "$name.chromosomes" "$DATA/$acc/genomic.gff" \
    | LC_ALL=C sort -t "$(printf '\t')" -k1,1 -k4,4n | gzip > "$name.gff.gz"
  echo "prepared $name: $(wc -l < "$name.chromosomes") chromosomes"
done < species.tsv

# ── The ortholog table: one row per human gene, one column per genome ────────
# The helper prints the column order it wrote, which is the order
# blockAssemblies and bedLocations below have to list.
# shellcheck disable=SC2046  # NAME=GFF pairs are a built argument list
BLOCK_COLUMNS=$(python3 "$SCRIPT_DIR/symbols_to_blocks.py" \
  --anchor "$ANCHOR" -o primates.blocks \
  $(for n in $NAMES; do printf '%s=%s.gff.gz ' "$n" "$n"; done))
# the adapter reads each file whole and unzips it itself
gzip -kf primates.blocks
for n in $NAMES; do gzip -kf "$n.bed"; done

# ── The JBrowse config ───────────────────────────────────────────────────────
python3 - "$BLOCK_COLUMNS" <<'PY'
import json, sys

columns = sys.argv[1].split()
species = {}
with open('species.tsv') as fh:
    for line in fh:
        name, _, hub, label = line.rstrip('\n').split(None, 3)
        species[name] = (hub, label)

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


# The hub's assembly entry and gene track, verbatim but for the lane label, and
# the short name as an alias so a session can say `human` or `chimp`.
def hub_parts(name):
    hub, label = species[name]
    config = json.load(open(f'hubs/{hub}.config.json'))
    base = open(f'hubs/{hub}.base').read().strip()
    assembly = next(a for a in config['assemblies'] if a['name'] == hub)
    by_id = {t['trackId']: t for t in config['tracks']}
    gene_id = next(f'{hub}-{k}' for k in gene_track_order if f'{hub}-{k}' in by_id)
    assembly = {**absolutize(assembly, base), 'displayName': label, 'aliases': [name]}
    return assembly, absolutize(by_id[gene_id], base)


parts = {n: hub_parts(n) for n in columns}
order = [parts[n][0]['name'] for n in columns]


def uri(u):
    return {'uri': u, 'locationType': 'UriLocation'}


config = {
    'assemblies': [parts[n][0] for n in columns],
    'configuration': {},
    'connections': [],
    'tracks': [parts[n][1] for n in columns] + [{
        'type': 'SyntenyTrack',
        'trackId': 'primate_orthologs',
        'name': f'Primate orthologs by gene symbol ({len(order)} genomes, RefSeq)',
        'assemblyNames': order,
        'adapter': {
            'type': 'MCScanBlocksAdapter',
            'mcscanBlocksLocation': uri('primates.blocks.gz'),
            'blockAssemblies': order,
            'bedLocations': [uri(f'{n}.bed.gz') for n in columns],
            'assemblyNames': order,
        },
        # Coloring a gene by its ortholog group runs one color down the whole
        # stack for a conserved gene and breaks the column where a lane lacks
        # it.
        'displays': [{
            'type': 'MultiWaySyntenyDisplay',
            'displayId': 'primate_orthologs-MultiWaySyntenyDisplay',
            'color': {'field': 'cluster'},
        }],
    }],
    'defaultSession': {
        'name': 'Primate orthologs',
        'views': [{
            'type': 'LinearGenomeView',
            'assembly': order[0],
            'loc': 'chr17:7,400,000-7,700,000',
            'tracks': ['primate_orthologs'],
        }],
    },
}
with open('config.json', 'w') as fh:
    fh.write(json.dumps(config, indent=2) + '\n')
PY

cat <<EOF

built in $OUTDIR:
  config.json                 $(wc -l < species.tsv) hub assemblies, their gene tracks and the ortholog track
  primates.blocks{,.gz}       the ortholog table, $(wc -l < primates.blocks) rows
  <genome>.bed{,.gz}          gene placements, one per genome

serve this directory and open config.json.
EOF
