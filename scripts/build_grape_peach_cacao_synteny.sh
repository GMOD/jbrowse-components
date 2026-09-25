#!/usr/bin/env bash
#
# Reproducibly build the multi-way MCScan .blocks synteny view shown in
# website/docs/tutorials/multiway_synteny_grape_peach_cacao.md, and a JBrowse
# config that loads it.
#
# Everything comes from NCBI datasets: one accession per species supplies the
# genome, the annotation and (through gffread) the CDS, so the table and the
# assembly it is drawn on are one build. The previous Ensembl Plants version
# produced a cacao BED on chromosomes 1..10 of an assembly that disagreed with
# the hosted one on all ten lengths, drawing genes at plausible wrong
# coordinates.
#
# The three assemblies and their gene tracks are the genomes' GenArk hubs on
# genomes.jbrowse.org, taken verbatim: the same RefSeq accessions, with the 2bit
# sequence, a chromAlias table that resolves the NC_ names in the BEDs, and the
# NCBI RefSeq genes.
#
# Requires: the NCBI `datasets` CLI, jcvi + the LAST aligner, gffread, samtools,
#           curl, python3
# Usage:    bash scripts/build_grape_peach_cacao_synteny.sh [outdir]
#
set -euo pipefail

OUTDIR="${1:-grape_peach_cacao_build}"
mkdir -p "$OUTDIR"
cd "$OUTDIR"

# Species table: short name, RefSeq accession.
#
# The first three are JBrowse assemblies, rows of the stacked view with their
# gene tracks. The rest are BLOCKS-ONLY mates: lanes on the grape axis, which
# MCScanBlocksAdapter resolves from the .blocks table plus that species' BED.
# They still need the genome downloaded, because the CDS is extracted from it.
ASSEMBLY_SPECIES='
grape  GCF_030704535.1
peach  GCF_000346465.2
cacao  GCF_000208745.1
'
# Grape is a basal rosid, so these span the divergences rather than repeating
# one: two more rosid orders, and tomato as an asterid outgroup where the
# expectation is visibly fewer blocks.
BLOCKS_ONLY_SPECIES='
arabidopsis  GCF_000001735.4
poplar       GCF_000002775.5
tomato       GCF_036512215.1
citrus       GCF_000493195.1
'
# Every list below is derived from the two tables above rather than hand-kept,
# and each is an array rather than a space-separated string: they are expanded
# into command arguments, and the string form needed an unquoted `$(for ...)` at
# every one of those points, which is word splitting shellcheck is right to flag.
# NF, because each table above opens with a blank line
names_of() { awk 'NF {print $1}' <<<"$1"; }
mapfile -t ASSEMBLY_NAMES < <(names_of "$ASSEMBLY_SPECIES")
mapfile -t BLOCKS_ONLY_NAMES < <(names_of "$BLOCKS_ONLY_SPECIES")
# grape is the reference, so the mates are every other genome. This is the
# .blocks column order the join below writes, and therefore the order
# blockAssemblies and bedLocations have to list.
MATES=("${ASSEMBLY_NAMES[@]:1}" "${BLOCKS_ONLY_NAMES[@]}")
COLUMNS=("${ASSEMBLY_NAMES[0]}" "${MATES[@]}")

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
  # ORGANELLES AND `?` STRAND ARE BOTH DROPPED before anything reads this GFF,
  # and both because gffread treats them as fatal rather than skippable:
  #   - strand `?` is what NCBI gives a trans-spliced plastid gene (rps12), and
  #     gffread exits with "Error parsing strand (?)" having written an EMPTY
  #     CDS file, which reads as a silent pipeline failure three steps later
  #   - a mitochondrial gene can carry a coordinate past the end of its own
  #     circular sequence (arabidopsis rna-DA397_mgp37 on NC_037304.1) and
  #     gffread exits with "improper genomic coordinate"
  # Dropping them is right on the merits anyway: an organelle gene has no place
  # in a nuclear synteny table. The list is NCBI's own classification from the
  # sequence report, not a guess from the accession.
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
done <<EOF
$ASSEMBLY_SPECIES
$BLOCKS_ONLY_SPECIES
EOF

# ── BED + CDS, keyed identically ─────────────────────────────────────────────
# BOTH are keyed on the mRNA's GFF3 `ID`, which is what makes the join work:
# gffread names each extracted CDS after that ID (`rna-XM_007225519.2`), and
# jcvi's default `--key=ID` writes the same string into BED column 4. Checked on
# peach, where all 23,134 BED names are present in the CDS set. Do NOT reach for
# `--key=transcript_id` or `--key=Name` here even though NCBI carries both: jcvi
# silently falls back to a generated `mrna_494685` when it cannot resolve the
# key, and a BED full of those joins to nothing.
for sp in "${COLUMNS[@]}"; do
  [ -f "$sp.cds.fa" ] || gffread "$sp.gff3" -g "$sp.fa" -x "$sp.cds.fa"
  [ -f "$sp.bed" ] || python -m jcvi.formats.gff bed --type=mRNA --key=ID \
    --primary_only "$sp.gff3" -o "$sp.bed"
  [ -f "$sp.cds" ] || python -m jcvi.formats.fasta format "$sp.cds.fa" "$sp.cds"
done

# ── jcvi: orthologs vs grape, MCScan each pair, join into one .blocks table ───
for sp in "${MATES[@]}"; do
  [ -f "grape.$sp.lifted.anchors" ] || \
    python -m jcvi.compara.catalog ortholog --no_strip_names grape "$sp"
  [ -f "grape.$sp.i1.blocks" ] || \
    python -m jcvi.compara.synteny mcscan grape.bed "grape.$sp.lifted.anchors" \
      --iter=1 -o "grape.$sp.i1.blocks"
done
# Each per-pair table is two columns, grape then the mate, so an N-way join
# emits the grape column N times. Keep column 1 and every even column after it:
# that is the grape anchor followed by one mate per lane, in MATES order, which
# is the order blockAssemblies and bedLocations have to list.
if [ ! -f grape.blocks ]; then
  keep=1; col=2
  tables=()
  for sp in "${MATES[@]}"; do
    keep="$keep,$col"
    col=$((col + 2))
    tables+=("grape.$sp.i1.blocks")
  done
  python -m jcvi.formats.base join "${tables[@]}" \
    --noheader | cut -f"$keep" > grape.blocks
fi

# ── Compress blocks + BEDs (the adapter reads plain or gzipped) ──────────────
gzip -kf grape.blocks "${COLUMNS[@]/%/.bed}"

# ── What the reference column costs the non-reference bands ──────────────────
# The tutorial's "direct vs transitive pairs" section, read off the table
# instead of asserted: a band between two mates can only draw a row where BOTH
# of them resolve, and this table has a row only where GRAPE had an ortholog to
# anchor it. So for each pair the count below is an upper bound the reference
# imposed, not a measurement of the two genomes. Grape's own pairs are the
# control: they are direct MCScan alignments, so they are what the same table
# looks like when nothing is lost in the middle.
python3 - "${COLUMNS[*]}" <<'PY'
import gzip
import itertools
import sys

names = sys.argv[1].split()
resolved = [0] * len(names)
both = {}
with gzip.open('grape.blocks.gz', 'rt') as fh:
    for line in fh:
        cols = line.rstrip('\n').split('\t')
        present = [i for i, c in enumerate(cols[:len(names)]) if c and c != '.']
        for i in present:
            resolved[i] += 1
        for pair in itertools.combinations(present, 2):
            both[pair] = both.get(pair, 0) + 1

print()
print('rows per genome, and rows per pair (what each band can draw):')
for i, name in enumerate(names):
    print(f'  {name:12s} {resolved[i]:6d} rows')
for (i, j), n in sorted(both.items(), key=lambda kv: -kv[1]):
    direct = ' (direct)' if 0 in (i, j) else ''
    share = n / min(resolved[i], resolved[j]) if min(resolved[i], resolved[j]) else 0
    print(f'  {names[i]:12s} {names[j]:12s} {n:6d} rows, '
          f'{share:.0%} of the smaller column{direct}')
PY

# ── The hub each assembly is taken from ──────────────────────────────────────
# A RefSeq genome is a GenArk hub on genomes.jbrowse.org under its accession,
# whose path is the accession cut into GCF/000/346/465/<accession>.
mkdir -p hubs
while read -r name acc; do
  [ -z "$name" ] && continue
  base="https://jbrowse.org/hubs/genark/${acc:0:3}/${acc:4:3}/${acc:7:3}/${acc:10:3}/$acc"
  echo "$base" > "hubs/$acc.base"
  [ -s "hubs/$acc.config.json" ] || curl -fsS -o "hubs/$acc.config.json" "$base/config.json"
done <<<"$ASSEMBLY_SPECIES"

# ── The JBrowse config ───────────────────────────────────────────────────────
# Each assembly and its gene track are the hub's, verbatim but for the lane
# label, with the short name as an alias so a session can still say `grape`.
# The track's assemblyNames lists only these three: a LinearSyntenyView row
# on an assembly the config does not define comes up "No tracks active". The
# blocks-only mates live in the adapter, which draws their lanes from the table
# and their BEDs alone.
python3 - "${COLUMNS[*]}" "$ASSEMBLY_SPECIES" <<'PY'
import json, sys

names = sys.argv[1].split()
accession = dict(line.split() for line in sys.argv[2].strip().splitlines())

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


parts = {n: hub_parts(n) for n in accession}
declared = [accession[n] for n in accession]
columns = [accession.get(n, n) for n in names]

config = {
    'assemblies': [parts[n][0] for n in accession],
    'tracks': [parts[n][1] for n in accession] + [{
        'type': 'SyntenyTrack',
        'trackId': 'grape_peach_cacao_blocks',
        'name': 'Grape vs %s (MCScan blocks)' % ', '.join(names[1:]),
        'assemblyNames': declared,
        'adapter': {
            'type': 'MCScanBlocksAdapter',
            'uri': 'grape.blocks.gz',
            'blockAssemblies': columns,
            'bedLocations': [{'uri': f'{n}.bed.gz'} for n in names],
            'assemblyNames': columns,
        },
    }],
    'defaultSession': {
        'name': 'Grape / Peach / Cacao multi-way synteny',
        'views': [{
            'type': 'LinearSyntenyView',
            'displayName': 'Peach - Cacao - Grape (MCScan blocks)',
            'views': [{'assembly': accession[n]} for n in ('peach', 'cacao', 'grape')],
            'tracks': [['grape_peach_cacao_blocks'], ['grape_peach_cacao_blocks']],
            'color': {'field': 'reference'},
            'autoDiagonalize': True,
        }],
    },
}
with open('config.json', 'w') as fh:
    fh.write(json.dumps(config, indent=2) + '\n')
PY

cat <<EOF

built in $(pwd):
  config.json         the three hub assemblies, their gene tracks, the MCScan
                      blocks track and a stacked default session
  grape.blocks.gz     the ortholog table, $(wc -l < grape.blocks) rows
  <genome>.bed.gz     gene placements, one per genome

serve this directory and open config.json, e.g. npx serve $(pwd)
EOF
