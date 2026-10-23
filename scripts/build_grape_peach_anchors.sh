#!/usr/bin/env bash
#
# Reproducibly build the pairwise grape vs peach MCScan anchors synteny view
# shown in website/docs/tutorials/mcscan_synteny_grape_peach.md, and a JBrowse
# config that loads it.
#
# Grape and peach are the RefSeq accessions the three-genome page uses
# (scripts/build_grape_peach_cacao_synteny.sh), fetched, filtered and keyed the
# same way, so the two pages draw one grape and one peach and the BEDs written
# here are the ones that build hosts. Its `catalog ortholog grape peach` step
# writes these same two anchor files.
#
# The assemblies and their gene tracks are the genomes' GenArk hubs on
# genomes.jbrowse.org, taken verbatim but for the label.
#
# Requires: the NCBI `datasets` CLI, jcvi + the LAST aligner, gffread, samtools,
#           curl, python3
# Usage:    bash scripts/build_grape_peach_anchors.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-grape_peach_anchors_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# Short name, RefSeq accession
SPECIES='
grape  GCF_030704535.1
peach  GCF_000346465.2
'

# ── Fetch genome + annotation + sequence report, one accession per species ───
while read -r name acc; do
  [ -z "$name" ] && continue
  if [ ! -d "dl_$name" ]; then
    datasets download genome accession "$acc" \
      --include genome,gff3,seq-report --filename "$name.zip"
    unzip -oq "$name.zip" -d "dl_$name"
    rm -f "$name.zip"
  fi
  d="dl_$name/ncbi_dataset/data/$acc"
  [ -f "$name.fa" ]     || cp "$d"/*_genomic.fna "$name.fa"
  [ -f "$name.fa.fai" ] || samtools faidx "$name.fa"
  [ -f "$name.seqreport.jsonl" ] || cp "$d/sequence_report.jsonl" \
    "$name.seqreport.jsonl"
  # Organelle genes and `?`-strand genes are dropped before gffread reads the
  # GFF3, which treats both as fatal: see build_grape_peach_cacao_synteny.sh.
  if [ ! -f "$name.gff3" ]; then
    python3 -c "
import json, sys
sp = sys.argv[1]
drop = set()
for line in open(sp + '.seqreport.jsonl'):
    d = json.loads(line)
    if d.get('assignedMoleculeLocationType') in (
            'Mitochondrion', 'Chloroplast', 'Plastid', 'Apicoplast'):
        a = d.get('refseqAccession') or d.get('genbankAccession')
        if a:
            drop.add(a)
open(sp + '.organelles.txt', 'w').write('\\n'.join(sorted(drop)) + '\\n')
" "$name"
    awk -F'\t' -v drops="$name.organelles.txt" 'BEGIN{OFS="\t"
        while ((getline l < drops) > 0) if (l != "") skip[l]=1 }
      /^#/{print;next} !($1 in skip) && ($7=="+"||$7=="-"){print}' \
      "$d/genomic.gff" > "$name.gff3"
  fi
done <<<"$SPECIES"

# ── BED + CDS, keyed identically ─────────────────────────────────────────────
# gffread names each CDS after its mRNA's GFF3 `ID` (`rna-XM_...`), and jcvi's
# `--key=ID` writes the same string into BED column 4. On an NCBI GFF3,
# `--key=transcript_id` and `--key=Name` fall back to generated `mrna_NNNNNN`
# names that join nothing.
for sp in grape peach; do
  [ -f "$sp.cds.fa" ] || gffread "$sp.gff3" -g "$sp.fa" -x "$sp.cds.fa"
  [ -f "$sp.bed" ] || python -m jcvi.formats.gff bed --type=mRNA --key=ID \
    --primary_only "$sp.gff3" -o "$sp.bed"
  [ -f "$sp.cds" ] || python -m jcvi.formats.fasta format "$sp.cds.fa" "$sp.cds"
done

# ── jcvi: the ortholog run writes the gene pairs, screen the blocks ──────────
# --no_strip_names keeps the gene ids byte-identical to the BEDs. Without it the
# adapters drop every row whose gene neither BED has, which for a whole-file
# suffix mismatch is every row. --no_dotplot skips jcvi's own PDF, which needs a
# LaTeX install and nothing here reads.
#
# Guarded like every other step, because this one is the LAST alignment and by
# far the longest.
[ -f grape.peach.anchors ] || \
  python -m jcvi.compara.catalog ortholog --no_strip_names --no_dotplot grape peach
# screen --simple writes grape.peach.anchors.simple, one line per block, beside
# the screened copy; --minspan=30 keeps blocks spanning 30 genes or more
[ -f grape.peach.anchors.simple ] || \
  python -m jcvi.compara.synteny screen --minspan=30 --simple \
    grape.peach.anchors grape.peach.anchors.new

# ── Compress anchors + BEDs (the adapters read plain or gzipped) ─────────────
gzip -kf grape.peach.anchors grape.peach.anchors.simple grape.bed peach.bed

# ── The hub each assembly is taken from ──────────────────────────────────────
# A RefSeq genome is a GenArk hub on genomes.jbrowse.org under its accession,
# whose path is the accession cut into GCF/000/346/465/<accession>.
mkdir -p hubs
while read -r name acc; do
  [ -z "$name" ] && continue
  base="https://jbrowse.org/hubs/genark/${acc:0:3}/${acc:4:3}/${acc:7:3}/${acc:10:3}/$acc"
  echo "$base" > "hubs/$acc.base"
  [ -s "hubs/$acc.config.json" ] || curl -fsS -o "hubs/$acc.config.json" "$base/config.json"
done <<<"$SPECIES"

# ── The JBrowse config ───────────────────────────────────────────────────────
# Each assembly and its gene track are the hub's, with the short name as an
# alias so a session can still say `grape`. Both anchor tracks name the
# assemblies grape first, the order of the anchor files' columns.
python3 - "$SPECIES" <<'PY'
import json, sys

accession = dict(line.split() for line in sys.argv[1].strip().splitlines())

uri_keys = {'uri', 'chromSizes'}
gene_track_order = ['ncbiRefSeq', 'ncbiRefSeqCurated', 'ncbiGene']


def absolutize(node, base):
    if isinstance(node, dict):
        return {
            k: f'{base}/{v}' if k in uri_keys and isinstance(v, str) and '://' not in v
            else absolutize(v, base)
            for k, v in node.items()
        }
    return [absolutize(x, base) for x in node] if isinstance(node, list) else node


def hub_parts(name):
    acc = accession[name]
    config = json.load(open(f'hubs/{acc}.config.json'))
    base = open(f'hubs/{acc}.base').read().strip()
    assembly = next(a for a in config['assemblies'] if a['name'] == acc)
    by_id = {t['trackId']: t for t in config['tracks']}
    gene_id = next(f'{acc}-{k}' for k in gene_track_order if f'{acc}-{k}' in by_id)
    assembly = {**absolutize(assembly, base), 'displayName': name, 'aliases': [name]}
    return assembly, absolutize(by_id[gene_id], base)


grape, peach = accession['grape'], accession['peach']
parts = {n: hub_parts(n) for n in accession}


def anchors_track(track_id, name, adapter, uri):
    return {
        'type': 'SyntenyTrack',
        'trackId': track_id,
        'name': name,
        'assemblyNames': [grape, peach],
        'adapter': {
            'type': adapter,
            'uri': uri,
            'bed1': 'grape.bed.gz',
            'bed2': 'peach.bed.gz',
            'assemblyNames': [grape, peach],
        },
    }


config = {
    'assemblies': [parts[n][0] for n in accession],
    'tracks': [parts[n][1] for n in accession] + [
        anchors_track('grape_peach_anchors', 'Grape peach synteny (MCScan, anchors)',
                      'MCScanAnchorsAdapter', 'grape.peach.anchors.gz'),
        anchors_track('grape_peach_anchors_simple',
                      'Grape peach synteny (MCScan, simple anchors)',
                      'MCScanSimpleAnchorsAdapter', 'grape.peach.anchors.simple.gz'),
    ],
    'defaultSession': {
        'name': 'Grape vs Peach MCScan anchors',
        'views': [{
            'type': 'LinearSyntenyView',
            'displayName': 'Peach - Grape (MCScan anchors)',
            'views': [{'assembly': peach}, {'assembly': grape}],
            'tracks': [['grape_peach_anchors', 'grape_peach_anchors_simple']],
            'mark': {'interpolate': 'bump'},
            'autoDiagonalize': True,
        }],
    },
}
with open('config.json', 'w') as fh:
    fh.write(json.dumps(config, indent=2) + '\n')
PY

cat <<EOF

built in $(pwd):
  config.json                    the two hub assemblies, their gene tracks,
                                 both MCScan anchor tracks and a default session
  grape.peach.anchors.gz         gene pairs, $(grep -vc '^#' grape.peach.anchors) rows
  grape.peach.anchors.simple.gz  blocks, $(wc -l < grape.peach.anchors.simple) rows
  grape.bed.gz, peach.bed.gz     gene placements

serve this directory and open config.json, e.g. npx serve $(pwd)
EOF
