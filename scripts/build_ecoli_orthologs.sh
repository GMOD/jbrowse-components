#!/usr/bin/env bash
#
# Stack 47 E. coli and Shigella genomes as lanes of one MultiWaySyntenyDisplay
# from their RefSeq annotations alone: no genome FASTA, no aligner.
#
# The sibling builders (build_ecoli_pangenome_synteny.sh, _graph, _cactus)
# describe five strains to each other by aligning them. This one joins the
# annotations on the gene symbol with symbols_to_blocks.py, the route
# build_primate_orthologs.sh takes for eight primates, so the download is a
# GFF3 and a sequence report per genome and the table builds in seconds. What
# the join cannot see is the accessory genome: at the O-antigen cluster the
# genes that differ between strains share no symbol, and the lanes draw their
# own genes there with no ribbon between them.
#
# The strain list is what survived a screen, not a list picked by name. A
# hundred RefSeq E. coli accessions were tried on 2026-09-02: 18 no longer
# download, two are phage genomes, and a quarter of the rest carry PGAP
# annotations that name genes by locus tag only, so they join nothing. What is
# pinned below is every one whose longest sequence is a chromosome (4 Mb or
# more) and whose annotation names at least 2,000 genes, in the order first
# tried: the classic reference strains across phylogroups A, B1, B2, D and E,
# four Shigella (E. coli by phylogeny), then complete genomes picked by striding
# a `datasets summary` listing. The count each annotation names is the screen
# to re-run before adding a strain:
#
#   gzip -dc strain.gff.gz | awk -F'\t' '$3 == "gene" && $9 ~ /;gene=/' | wc -l
#
# Requires: the NCBI `datasets` CLI, bgzip/tabix (htslib), unzip, python3
# Usage:    bash build_ecoli_orthologs.sh [outdir]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS=(symbols_to_blocks.py)
for h in "${HELPERS[@]}"; do
  [ -f "$SCRIPT_DIR/$h" ] || curl -fsSL -o "$SCRIPT_DIR/$h" \
    "https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/$h"
done

OUTDIR="${1:-ecoli_orthologs_build}"

# name, RefSeq accession. The first is the anchor: every row of the table is
# one of its genes, and K-12 MG1655 is the strain the rest are described
# against in the literature.
read -r -d '' STRAINS <<'TABLE' || true
MG1655               GCF_000005845.2
DH10B                GCF_000019425.1
Sakai                GCF_000008865.2
EDL933               GCF_000006665.1
CFT073               GCF_000007445.1
UTI89                GCF_000013265.1
S88                  GCF_000026285.1
UMN026               GCF_000026325.1
IAI39                GCF_000026345.1
IAI1                 GCF_000026265.1
Ec55989              GCF_000026245.1
ED1a                 GCF_000026305.1
O104H4               GCF_000299455.1
E24377A              GCF_000017745.1
HS                   GCF_000017765.1
SE11                 GCF_000010385.1
ATCC8739             GCF_000019385.1
SMS35                GCF_000019645.1
BL21DE3              GCF_000022665.1
APECO1               GCF_000014845.1
Nissle1917           GCF_003546975.1
NCTC86               GCF_002007705.1
Sflex301             GCF_000006925.2
Sdys197              GCF_000012005.1
Sboy227              GCF_000012025.1
Sson53G              GCF_000283715.1
ST540                GCF_000597845.1
ST2747               GCF_000599665.1
BL21_TaKaRa          GCF_000833145.1
SF_166               GCF_000953515.1
K_12_substr_MG1655   GCF_001308125.1
S2012C_4227          GCF_001420955.1
S2011C_4315          GCF_001518835.1
UPEC_26_1            GCF_001566615.1
FORC_028             GCF_001596115.1
S210221272           GCF_001612495.1
D8                   GCF_001650295.1
M19                  GCF_001901215.1
S30                  GCF_001901365.1
S56                  GCF_001901445.1
tolC                 GCF_001932515.1
WCHEC050613          GCF_001969285.3
MGY                  GCF_001999185.1
JJ2434               GCF_001039415.1
CI5                  GCF_001559675.1
GB089                GCF_001566635.1
S06_00048            GCF_001612515.1
TABLE

mkdir -p "$OUTDIR"
cd "$OUTDIR"
echo "$STRAINS" > strains.tsv
ANCHOR=$(head -1 strains.tsv | awk '{print $1}')
NAMES=$(awk '{print $1}' strains.tsv)

# ── GFF3 and sequence report per genome, in one archive ──────────────────────
mkdir -p ncbi
awk '{print $2}' strains.tsv > ncbi/accessions.txt
if [ ! -f ncbi/genomes.zip ]; then
  datasets download genome accession --inputfile ncbi/accessions.txt \
    --include gff3,seq-report --filename ncbi/genomes.zip --no-progressbar
fi
if [ ! -d ncbi/extract/ncbi_dataset/data ]; then
  unzip -q -o ncbi/genomes.zip -d ncbi/extract
fi
DATA=ncbi/extract/ncbi_dataset/data

# ── Per genome: the chromosome, its length, its indexed GFF3 ─────────────────
# The chromosome is the longest sequence in the report and the plasmids are
# dropped: a lane follows one contig, and a plasmid lane would draw on
# whichever one the window's placements happened to favour.
while read -r name acc; do
  if [ -f "$name.gff.gz.tbi" ]; then
    echo "reusing $name"
    continue
  fi
  python3 - "$DATA/$acc/sequence_report.jsonl" "$name.chrom.sizes" <<'PY'
import json, sys
report, out = sys.argv[1:]
best = None
with open(report) as fh:
    for line in fh:
        r = json.loads(line)
        acc = r.get('refseqAccession') or r.get('genbankAccession')
        if acc and (best is None or r['length'] > best[1]):
            best = (acc, r['length'])
with open(out, 'w') as sizes:
    sizes.write(f'{best[0]}\t{best[1]}\n')
PY
  # -t is not optional: GFF3 attribute columns contain spaces, so a sort
  # without an explicit tab separator sorts on the wrong field and tabix then
  # rejects the file for unsorted positions.
  awk 'NR == FNR { keep[$1] = 1; next } /^#/ { next } ($1 in keep)' \
    "$name.chrom.sizes" "$DATA/$acc/genomic.gff" \
    | LC_ALL=C sort -t "$(printf '\t')" -k1,1 -k4,4n > "$name.gff"
  bgzip -f "$name.gff"
  tabix -f -p gff "$name.gff.gz"
  # the screen from the header, printed per genome so a strain that joins
  # nothing is visible here rather than as an empty lane
  named=$(gzip -dc "$name.gff.gz" | awk -F'\t' '$3 == "gene" && $9 ~ /;gene=/' | wc -l)
  echo "prepared $name: $(cut -f1 "$name.chrom.sizes") $(cut -f2 "$name.chrom.sizes") bp, $named named genes"
done < strains.tsv

# ── The ortholog table: one row per K-12 gene, one column per genome ─────────
# PGAP writes the locus tag into Name= for a gene it could not name, so
# without --unnamed every hypothetical protein would look named and join
# nothing. The helper prints the column order it wrote, which is the order
# blockAssemblies and bedLocations below have to list.
# shellcheck disable=SC2046  # NAME=GFF pairs are a built argument list
BLOCK_ASSEMBLIES=$(python3 "$SCRIPT_DIR/symbols_to_blocks.py" \
  --anchor "$ANCHOR" -o ecoli.blocks --unnamed '_RS[0-9]+$' \
  $(for n in $NAMES; do printf '%s=%s.gff.gz ' "$n" "$n"; done))

# ── The JBrowse config ───────────────────────────────────────────────────────
python3 - "$BLOCK_ASSEMBLIES" <<'PY'
import json, sys
order = sys.argv[1].split()

def uri(u):
    return {'uri': u, 'locationType': 'UriLocation'}

def chromosome(name):
    with open(f'{name}.chrom.sizes') as fh:
        return fh.readline().split('\t')[0]

config = {
    'assemblies': [{
        'name': n,
        'sequence': {
            'type': 'ReferenceSequenceTrack',
            'trackId': f'{n}-ReferenceSequenceTrack',
            'adapter': {'type': 'ChromSizesAdapter', 'chromSizesLocation': uri(f'{n}.chrom.sizes')},
        },
    } for n in order],
    'configuration': {},
    'connections': [],
    'tracks': [{
        'type': 'FeatureTrack',
        'trackId': f'{n}_genes',
        'name': f'{n} genes (RefSeq)',
        'assemblyNames': [n],
        'adapter': {
            'type': 'Gff3TabixAdapter',
            'gffGzLocation': uri(f'{n}.gff.gz'),
            'index': {'location': uri(f'{n}.gff.gz.tbi'), 'indexType': 'TBI'},
        },
    } for n in order] + [{
        'type': 'SyntenyTrack',
        'trackId': 'ecoli_orthologs',
        'name': f'E. coli orthologs by gene symbol ({len(order)} genomes, RefSeq)',
        'assemblyNames': order,
        'adapter': {
            'type': 'MCScanBlocksAdapter',
            'mcscanBlocksLocation': uri('ecoli.blocks'),
            'blockAssemblies': order,
            'bedLocations': [uri(f'{n}.bed') for n in order],
            'assemblyNames': order,
        },
        # Orthologs share a symbol, so coloring a gene by its name runs one
        # color down the whole stack for a conserved gene and breaks the
        # column where a lane lacks it. The height is what 47 lanes need for
        # every header to draw.
        'displays': [{
            'type': 'MultiWaySyntenyDisplay',
            'displayId': 'ecoli_orthologs-MultiWaySyntenyDisplay',
            'color': "jexl:feature.name ? randomColor(feature.name) : '#b0b0b0'",
            'height': 1100,
        }],
    }],
    'defaultSession': {
        'name': 'E. coli orthologs',
        'views': [{
            'type': 'LinearGenomeView',
            'assembly': order[0],
            # the atp operon, conserved across the collection
            'loc': f'{chromosome(order[0])}:3,910,000-3,925,000',
            'tracks': ['ecoli_orthologs'],
        }],
    },
}
with open('config.json', 'w') as fh:
    fh.write(json.dumps(config, indent=2) + '\n')
PY

cat <<EOF

built in $OUTDIR:
  config.json                 $(wc -l < strains.tsv) assemblies, the gene tracks and the ortholog track
  ecoli.blocks                the ortholog table, $(wc -l < ecoli.blocks) rows
  <strain>.bed                gene placements, one per genome
  <strain>.gff.gz{,.tbi}      the annotation each lane draws
  <strain>.chrom.sizes        the chromosome and its length

serve this directory and open config.json.
EOF
