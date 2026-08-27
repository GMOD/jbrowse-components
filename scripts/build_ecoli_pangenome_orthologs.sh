#!/usr/bin/env bash
#
# Build a 100-genome E. coli ortholog stack for MultiWaySyntenyDisplay, with no
# alignment step at all.
#
# The sibling builders here (build_ecoli_pangenome_synteny.sh, _graph, _cactus)
# all describe the genomes to each other by ALIGNING them. That is O(N^2) and it
# is what stops those demos at five strains: 26 genomes is 325 pairwise
# minimap2 runs and measured 1,171 s on four threads, so 100 genomes would be
# 4,950 pairs and roughly five hours. This script takes the other route. RefSeq's
# annotation pipeline gives orthologous genes the same gene symbol across
# strains, so an MCScan-style ortholog table can be built by EQUALITY ON THAT
# SYMBOL — a join, not a comparison. The 100-genome table below builds in
# seconds, and the download is ~35 MB because it fetches no FASTA.
#
# Two consequences worth knowing before you pick a route:
#
#   * An ortholog table is also the SHAPE this display wants. A lane's frame is
#     fitted to the placements covering the window, so an assembly-level PAF —
#     whose records are whole collinear blocks, mean 33 kb and up to 2.58 Mb —
#     pushes mate lanes to 3-80x the anchor's scale at a gene-neighbourhood
#     zoom, and their genes collapse into a solid bar. One placement per gene
#     keeps every lane at 1-1.5x. Alignment records are the wrong granularity
#     here even when you can afford them.
#
#   * The symbol join is blind to the accessory genome, which is the honest
#     limit of doing it this cheaply. At a conserved locus (the atp operon) the
#     table yields 15 groups; at the hypervariable O-antigen cluster it yields
#     4, because the genes that differ between strains share no symbols. For the
#     variable loci you want real protein clustering (mmseqs2 linclust or
#     DIAMOND over the proteomes, near-linear) feeding the same .blocks shape.
#
# The assemblies use ChromSizesAdapter rather than a bgzip FASTA on purpose: the
# display never reads sequence, and with 26 genomes the FASTA indexes cost 32.8 s
# of first paint against 3.2 s for chrom.sizes — same genomes, same table, only
# the adapter changed.
#
# Everything is pinned (fixed RefSeq accessions), so re-running reproduces the
# same stack.
#
# Requires: the NCBI `datasets` CLI, bgzip/tabix (htslib), unzip, node.
# Usage:    bash scripts/build_ecoli_pangenome_orthologs.sh [outdir] [ngenomes]
#
set -euo pipefail

OUTDIR="${1:-ecoli_orthologs_build}"
NGENOMES="${2:-100}"

# Column 1 is the assembly name JBrowse shows and the lane is labelled with;
# column 2 is the pinned RefSeq accession. The first entry is the ANCHOR: the
# table is reference-anchored on it, so every row is one of its genes and every
# other column is that gene's ortholog. K-12 MG1655 is first because it is the
# strain the rest are described against in the literature.
#
# The first 26 are the diversity set — the classic reference strains across
# phylogroups A, B1, B2, D and E, plus four Shigella, which are E. coli by
# phylogeny whatever the genus says. Their symbol fill against the anchor is
# 80-91%, and Shigella's is 50-60% because those genomes are reduced and their
# naming is less complete. The remaining 74 broaden the sample and were picked
# by striding a `datasets summary` listing of complete annotated genomes, one
# per strain, so no single submission's replicates dominate.
read -r -d '' STRAIN_TABLE <<'TABLE' || true
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
S94_3024             GCF_000759795.1
S789                 GCF_000778165.1
BL21_TaKaRa          GCF_000833145.1
CFSAN029787          GCF_000834055.1
C43_DE3              GCF_000836635.1
DH1Ec095             GCF_000892555.1
DH1Ec169             GCF_000892595.1
SF_166               GCF_000953515.1
K_12_substr_MG1655   GCF_001308125.1
S2012C_4227          GCF_001420955.1
YD786                GCF_001433375.1
Ecol_745             GCF_001449105.1
S2011C_3911          GCF_001482525.1
S2011C_4315          GCF_001518835.1
NGF1                 GCF_001521915.1
Eco889               GCF_001522005.1
S08_00022            GCF_001522165.1
Eco899               GCF_001522225.1
EC590                GCF_001559615.1
UPEC_26_1            GCF_001566615.1
FORC_028             GCF_001596115.1
S210221272           GCF_001612495.1
Y5                   GCF_001618885.1
MRSN346638           GCF_001635075.1
MRSN346595           GCF_001635115.1
D8                   GCF_001650295.1
H6                   GCF_001650495.1
H10                  GCF_001650515.1
C3                   GCF_001650535.1
C8                   GCF_001650555.1
D1                   GCF_001650575.1
D5                   GCF_001650595.1
D9                   GCF_001650615.1
H1                   GCF_001650635.1
H3                   GCF_001650655.1
S42                  GCF_001650675.1
H15                  GCF_001650695.1
M3                   GCF_001650715.1
M8                   GCF_001650735.1
M10                  GCF_001650755.1
M15                  GCF_001650775.1
M19                  GCF_001901215.1
S30                  GCF_001901365.1
S56                  GCF_001901445.1
tolC                 GCF_001932515.1
WCHEC050613          GCF_001969285.3
MGY                  GCF_001999185.1
MNCRE44              GCF_000836595.1
SF_088               GCF_000953795.1
JJ2434               GCF_001039415.1
SaT040               GCF_001281345.1
ZH193                GCF_001296405.1
Ecol_732             GCF_001449205.1
FORC_041             GCF_001518895.1
CI5                  GCF_001559675.1
GB089                GCF_001566635.1
D3                   GCF_001650395.1
H14                  GCF_001650435.1
S21                  GCF_001650455.1
C11                  GCF_001650475.1
K_12_substr_HMS174   GCF_000953555.1
ST648                GCF_001596155.1
S06_00048            GCF_001612515.1
MS6198               GCF_001618905.1
NADC_5570            GCF_001635095.1
S155                 GCF_001650315.1
S472                 GCF_001650335.1
S9000                GCF_001650355.1
S319                 GCF_001650375.1
MRSN346647           GCF_001635135.1
C4                   GCF_001650415.1
S28RC1               GCF_001901395.1
ECONIH1              GCF_000814125.1
TABLE

echo "$STRAIN_TABLE" | grep -v '^[[:space:]]*$' | head -n "$NGENOMES" > /tmp/ecoli_strains.$$
trap 'rm -f /tmp/ecoli_strains.$$' EXIT
ANCHOR=$(head -1 /tmp/ecoli_strains.$$ | awk '{print $1}')
echo "building a $(wc -l < /tmp/ecoli_strains.$$)-genome stack, anchor $ANCHOR"

mkdir -p "$OUTDIR"
cp /tmp/ecoli_strains.$$ "$OUTDIR/strains.tsv"
cd "$OUTDIR"
mkdir -p ncbi gff chromsizes blocks

# ── Fetch GFF3 and the sequence report only — no FASTA ────────────────────────
# The sequence report is what names the chromosome and its length; without it we
# would have to guess a contig or read a FASTA we otherwise never download.
awk '{print $2}' strains.tsv > ncbi/accessions.txt
if [ ! -f ncbi/genomes.zip ]; then
  datasets download genome accession --inputfile ncbi/accessions.txt \
    --include gff3,seq-report --filename ncbi/genomes.zip --no-progressbar
fi
rm -rf ncbi/extract
mkdir -p ncbi/extract
unzip -q -o ncbi/genomes.zip -d ncbi/extract
DATA=ncbi/extract/ncbi_dataset/data

# ── Per genome: pick the chromosome, write chrom.sizes, tabix the GFF3 ────────
# The chromosome is the longest sequence in the report. Plasmids are dropped:
# a lane can only follow one contig, and a plasmid lane would draw on whichever
# one the placements happened to favour.
while read -r name acc; do
  rep="$DATA/$acc/sequence_report.jsonl"
  gff="$DATA/$acc/genomic.gff"
  if [ ! -f "$rep" ] || [ ! -f "$gff" ]; then
    echo "  skipping $name ($acc): no gff3 or sequence report" >&2
    continue
  fi
  # NB the report is camelCase (refseqAccession), not the snake_case the rest
  # of the datasets JSON uses.
  read -r chr len < <(node -e '
    const rows = require("fs").readFileSync(process.argv[1], "utf8")
      .trim().split("\n").map(l => JSON.parse(l))
    let best
    for (const r of rows) {
      const acc = r.refseqAccession || r.genbankAccession
      const n = Number(r.length || 0)
      if (acc && (!best || n > best.n)) best = { acc, n }
    }
    if (best) console.log(best.acc, best.n)
  ' "$rep")
  if [ -z "${chr:-}" ]; then
    echo "  skipping $name ($acc): no sequence in report" >&2
    continue
  fi
  printf '%s\t%s\n' "$chr" "$len" > "chromsizes/$name.chrom.sizes"
  # -t is not optional: GFF3 attribute columns contain spaces, so a sort without
  # an explicit tab separator sorts on the wrong field and tabix then rejects
  # the file for unsorted positions.
  awk -v c="$chr" 'BEGIN{FS=OFS="\t"} /^#/{next} $1==c' "$gff" \
    | LC_ALL=C sort -t"$(printf '\t')" -k1,1 -k4,4n > "gff/$name.gff"
  bgzip -f "gff/$name.gff"
  tabix -f -p gff "gff/$name.gff.gz"
done < strains.tsv
echo "prepared $(find gff -name '*.gff.gz' | wc -l) annotations"

# ── The ortholog table: one row per anchor gene, one column per genome ────────
node - "$ANCHOR" <<'BUILD'
const fs = require('fs')
const { execSync } = require('child_process')
const anchor = process.argv[2]
const order = fs.readFileSync('strains.tsv', 'utf8').trim().split('\n')
  .map(l => l.trim().split(/\s+/)[0])
  .filter(n => fs.existsSync(`gff/${n}.gff.gz`))

// A real E. coli gene symbol is three lowercase letters then an uppercase
// letter or digit (thrA, yaaX, atpG). PGAP falls back to the locus_tag for an
// unnamed gene, so without this test every hypothetical protein would look
// named and join against nothing.
const SYMBOL = /^[a-z]{3}[A-Z0-9]/

function genes(name) {
  const out = []
  const txt = execSync(`zcat gff/${name}.gff.gz`, { maxBuffer: 1 << 30, encoding: 'utf8' })
  for (const line of txt.split('\n')) {
    if (!line || line[0] === '#') continue
    const f = line.split('\t')
    if (f[2] !== 'gene') continue
    const id = /(?:^|;)ID=([^;]*)/.exec(f[8] || '')?.[1]
    const sym = /(?:^|;)Name=([^;]*)/.exec(f[8] || '')?.[1]
    if (id) out.push({ refName: f[0], start: +f[3] - 1, end: +f[4], strand: f[6], id, sym })
  }
  return out
}

// The BED is what places a gene: the table carries ids only, and each column's
// id is matched against column 4 of that column's BED, byte for byte.
const bySymbol = new Map()
for (const name of order) {
  const g = genes(name)
  fs.writeFileSync(`blocks/${name}.bed`,
    g.map(x => `${x.refName}\t${x.start}\t${x.end}\t${x.id}\t0\t${x.strand}`).join('\n') + '\n')
  const m = new Map()
  // First occurrence wins. A symbol appearing twice in one genome is a paralog
  // and the table names one copy of it rather than expanding the row.
  for (const x of g) if (x.sym && SYMBOL.test(x.sym) && !m.has(x.sym)) m.set(x.sym, x.id)
  bySymbol.set(name, m)
  if (name === anchor) fs.writeFileSync('.anchor_genes.json', JSON.stringify(g))
}

const anchorGenes = JSON.parse(fs.readFileSync('.anchor_genes.json', 'utf8'))
  .filter(g => g.sym && SYMBOL.test(g.sym))
  .sort((a, b) => a.refName.localeCompare(b.refName) || a.start - b.start)
fs.unlinkSync('.anchor_genes.json')

const rows = []
const seen = new Set()
const filled = new Map(order.map(n => [n, 0]))
for (const g of anchorGenes) {
  if (seen.has(g.sym)) continue
  seen.add(g.sym)
  const cells = order.map(n => bySymbol.get(n).get(g.sym) ?? '.')
  // A row naming only the anchor links nothing, so it would be a row the
  // display walks and draws nothing for. Counted only for the rows that
  // survive, or the anchor's own fill reads over 100%.
  if (cells.filter(c => c !== '.').length < 2) continue
  rows.push(cells.join('\t'))
  for (const [i, n] of order.entries()) if (cells[i] !== '.') filled.set(n, filled.get(n) + 1)
}
fs.writeFileSync('blocks/ecoli.blocks', rows.join('\n') + '\n')

const uri = u => ({ uri: u, locationType: 'UriLocation' })
const config = {
  assemblies: order.map(n => ({
    name: n,
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: `${n}-ReferenceSequenceTrack`,
      adapter: { type: 'ChromSizesAdapter', chromSizesLocation: uri(`chromsizes/${n}.chrom.sizes`) },
    },
  })),
  configuration: {},
  connections: [],
  tracks: [
    ...order.map(n => ({
      type: 'FeatureTrack',
      trackId: `${n}_genes`,
      name: `${n} genes`,
      assemblyNames: [n],
      adapter: {
        type: 'Gff3TabixAdapter',
        gffGzLocation: uri(`gff/${n}.gff.gz`),
        index: { location: uri(`gff/${n}.gff.gz.tbi`), indexType: 'TBI' },
      },
    })),
    {
      type: 'SyntenyTrack',
      trackId: 'ecoli_orthologs',
      name: `E. coli gene-symbol orthologs (${order.length} genomes)`,
      assemblyNames: order,
      adapter: {
        type: 'MCScanBlocksAdapter',
        mcscanBlocksLocation: uri('blocks/ecoli.blocks'),
        // blockAssemblies and bedLocations are POSITIONAL against the table's
        // columns, which is the order `order` was written in. Get it wrong and
        // every gene is looked up in another genome's BED.
        blockAssemblies: order,
        bedLocations: order.map(n => uri(`blocks/${n}.bed`)),
        assemblyNames: order,
      },
      displays: [
        {
          type: 'MultiWaySyntenyDisplay',
          displayId: 'ecoli_orthologs-MultiWaySyntenyDisplay',
          // Orthologs share a symbol across strains, so hashing the gene name
          // to a hue makes a conserved gene one colour down the whole stack and
          // a strain-specific insert a break in that column.
          color:
            'jexl:get(feature,\'name\') == null ? "#b0b0b0" : "hsl(" + ' +
            '((charCodeAt(padEnd(get(feature,\'name\'),4,\'z\'),0)*13 + ' +
            'charCodeAt(padEnd(get(feature,\'name\'),4,\'z\'),1)*29 + ' +
            'charCodeAt(padEnd(get(feature,\'name\'),4,\'z\'),2)*47 + ' +
            'charCodeAt(padEnd(get(feature,\'name\'),4,\'z\'),3)*11) % 360) + ",72%,55%)"',
        },
      ],
    },
  ],
  defaultSession: {
    name: `E. coli ${order.length}-way orthologs`,
    views: [
      {
        type: 'LinearGenomeView',
        init: {
          assembly: order[0],
          // the atp operon: conserved across the collection, so every lane
          // places something and the ortholog columns run the full stack
          loc: `${fs.readFileSync(`chromsizes/${order[0]}.chrom.sizes`, 'utf8').split('\t')[0]}:3910000..3925000`,
          tracks: ['ecoli_orthologs'],
        },
      },
    ],
  },
}
fs.writeFileSync('config.json', JSON.stringify(config, null, 2))

console.log(`table: ${rows.length} rows x ${order.length} columns`)
const pct = n => Math.round((filled.get(n) / rows.length) * 100)
const fills = order.map(pct).sort((a, b) => a - b)
console.log(`column fill: ${fills[0]}%-${fills[fills.length - 1]}% (median ${fills[Math.floor(fills.length / 2)]}%)`)
BUILD

cat <<EOF

built in $OUTDIR:
  config.json               $(wc -l < strains.tsv) assemblies, $(( $(wc -l < strains.tsv) + 1 )) tracks
  blocks/ecoli.blocks       the ortholog table
  blocks/*.bed              gene placements, one per genome
  gff/, chromsizes/         annotations and sequence lengths

serve it from this directory and open config.json. The multi-way display is on
the synteny track; raise its height so every genome gets a lane (a lane needs
about 12px for its label to draw, so 100 genomes wants ~1200px).
EOF
