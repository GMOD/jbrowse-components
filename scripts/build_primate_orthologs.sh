#!/usr/bin/env bash
#
# Stack eight primate genomes as lanes of one MultiWaySyntenyDisplay, from
# their RefSeq annotations alone: no genome FASTA, no aligner.
#
# NCBI's annotation pipeline names a gene by its ortholog across species (human
# ATP5F1A is chimp ATP5F1A), so an ortholog table is a join on the gene symbol,
# which symbols_to_blocks.py does over the GFF3 files in a few seconds. The
# download is the GFF3 and the sequence report per genome, ~290 MB for eight,
# and each assembly is a ChromSizesAdapter over the report's chromosome lengths
# since the display never reads sequence. The same route with a PGAP bacterial
# annotation is `--unnamed '_RS[0-9]+$'` on the helper; what it cannot do in
# either kingdom is join a gene family whose copies got LOC ids (the AMY1
# cluster here) or the accessory genome of a pangenome.
#
# The genomes are the NHGRI T2T apes (v2.1 primary haplotypes), T2T macaque
# and GRCh38.p14, all reference assemblies with a current RefSeq annotation.
# Human is first because the table is anchored on it: every row is one human
# gene and the other columns are that gene's ortholog.
#
# Requires: the NCBI `datasets` and `dataformat` CLIs, bgzip/tabix (htslib),
#           unzip, python3
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

# name, RefSeq accession, label the lane header and track list show
read -r -d '' SPECIES <<'TABLE' || true
human     GCF_000001405.40  Human (GRCh38.p14)
chimp     GCF_028858775.2   Chimpanzee (NHGRI_mPanTro3-v2.1)
bonobo    GCF_029289425.2   Bonobo (NHGRI_mPanPan1-v2.1)
gorilla   GCF_029281585.2   Gorilla (NHGRI_mGorGor1-v2.1)
sumatran  GCF_028885655.2   Sumatran orangutan (NHGRI_mPonAbe1-v2.1)
bornean   GCF_028885625.2   Bornean orangutan (NHGRI_mPonPyg2-v2.1)
siamang   GCF_028878055.3   Siamang (NHGRI_mSymSyn1-v2.1)
macaque   GCF_049350105.2   Rhesus macaque (T2T-MMU8v2.0)
TABLE

mkdir -p "$OUTDIR"
cd "$OUTDIR"
echo "$SPECIES" > species.tsv
ANCHOR=$(head -1 species.tsv | awk '{print $1}')
NAMES=$(awk '{print $1}' species.tsv)

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

# ── Per genome: chromosome lengths, refName aliases, indexed GFF3 ─────────────
# The sequence report names every sequence and its length. The assembled
# chromosomes become the assembly (chrom.sizes) and everything else is dropped,
# so an unplaced scaffold's genes never get a lane placed on it. The same report
# through dataformat is the four-column alias table
# NcbiSequenceReportAliasAdapter reads, so `chr17` resolves to NC_000017.11.
while read -r name acc _; do
  if [ -f "$name.gff.gz.tbi" ]; then
    echo "reusing $name"
    continue
  fi
  python3 - "$DATA/$acc/sequence_report.jsonl" "$name.chrom.sizes" <<'PY'
import json, sys
report, out = sys.argv[1:]
with open(report) as fh, open(out, 'w') as sizes:
    for line in fh:
        r = json.loads(line)
        if r.get('role') == 'assembled-molecule' and r.get('assignedMoleculeLocationType') == 'Chromosome' and r.get('refseqAccession'):
            sizes.write(f"{r['refseqAccession']}\t{r['length']}\n")
PY
  dataformat tsv genome-seq --package ncbi/genomes.zip \
    --inputfile "$acc/sequence_report.jsonl" \
    --fields genbank-seq-acc,refseq-seq-acc,sequence-name,ucsc-style-name \
    > "$name.sequence_report.tsv"
  # -t is not optional: GFF3 attribute columns contain spaces, so a sort
  # without an explicit tab separator sorts on the wrong field and tabix then
  # rejects the file for unsorted positions.
  awk 'NR == FNR { keep[$1] = 1; next } /^#/ { next } ($1 in keep)' \
    "$name.chrom.sizes" "$DATA/$acc/genomic.gff" \
    | LC_ALL=C sort -t "$(printf '\t')" -k1,1 -k4,4n > "$name.gff"
  bgzip -f "$name.gff"
  tabix -f -p gff "$name.gff.gz"
  echo "prepared $name: $(wc -l < "$name.chrom.sizes") chromosomes"
done < species.tsv

# ── The ortholog table: one row per human gene, one column per genome ────────
# The helper prints the column order it wrote, which is the order
# blockAssemblies and bedLocations below have to list.
# shellcheck disable=SC2046  # NAME=GFF pairs are a built argument list
BLOCK_ASSEMBLIES=$(python3 "$SCRIPT_DIR/symbols_to_blocks.py" \
  --anchor "$ANCHOR" -o primates.blocks \
  $(for n in $NAMES; do printf '%s=%s.gff.gz ' "$n" "$n"; done))

# ── The JBrowse config ───────────────────────────────────────────────────────
python3 - "$BLOCK_ASSEMBLIES" <<'PY'
import json, sys
order = sys.argv[1].split()
labels = {}
with open('species.tsv') as fh:
    for line in fh:
        name, _, label = line.rstrip('\n').split(None, 2)
        labels[name] = label

def uri(u):
    return {'uri': u, 'locationType': 'UriLocation'}

config = {
    'assemblies': [{
        'name': n,
        'displayName': labels[n],
        'sequence': {
            'type': 'ReferenceSequenceTrack',
            'trackId': f'{n}-ReferenceSequenceTrack',
            'adapter': {'type': 'ChromSizesAdapter', 'chromSizesLocation': uri(f'{n}.chrom.sizes')},
        },
        'refNameAliases': {
            'adapter': {'type': 'NcbiSequenceReportAliasAdapter', 'location': uri(f'{n}.sequence_report.tsv')},
        },
    } for n in order],
    'configuration': {},
    'connections': [],
    'tracks': [{
        'type': 'FeatureTrack',
        'trackId': f'{n}_genes',
        'name': f'{labels[n]} genes (RefSeq)',
        'assemblyNames': [n],
        'adapter': {
            'type': 'Gff3TabixAdapter',
            'gffGzLocation': uri(f'{n}.gff.gz'),
            'index': {'location': uri(f'{n}.gff.gz.tbi'), 'indexType': 'TBI'},
        },
    } for n in order] + [{
        'type': 'SyntenyTrack',
        'trackId': 'primate_orthologs',
        'name': f'Primate orthologs by gene symbol ({len(order)} genomes, RefSeq)',
        'assemblyNames': order,
        'adapter': {
            'type': 'MCScanBlocksAdapter',
            'mcscanBlocksLocation': uri('primates.blocks'),
            'blockAssemblies': order,
            'bedLocations': [uri(f'{n}.bed') for n in order],
            'assemblyNames': order,
        },
        # Orthologs share a symbol, so coloring a gene by its name runs one
        # color down the whole stack for a conserved gene and breaks the
        # column where a lane lacks it.
        'displays': [{
            'type': 'MultiWaySyntenyDisplay',
            'displayId': 'primate_orthologs-MultiWaySyntenyDisplay',
            'color': "jexl:feature.name ? randomColor(feature.name) : '#b0b0b0'",
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
  config.json                 $(wc -l < species.tsv) assemblies, the gene tracks and the ortholog track
  primates.blocks             the ortholog table, $(wc -l < primates.blocks) rows
  <genome>.bed                gene placements, one per genome
  <genome>.gff.gz{,.tbi}      the annotation each lane draws
  <genome>.chrom.sizes        the assembly, <genome>.sequence_report.tsv its aliases

serve this directory and open config.json.
EOF
