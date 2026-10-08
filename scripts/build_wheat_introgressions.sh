#!/usr/bin/env bash
#
# One chromosome of the ten Wheat 10+ Genome assemblies aligned to Chinese
# Spring with minimap2, for a lane stack whose ribbons are coloured by percent
# identity: the chromosome alignment and the measure Walkowiak et al. 2020
# (Fig. 2, track iii) found alien introgressions with.
#
# GrainGenes hosts every assembly as bgzipped, faidx-indexed FASTA, so one
# chromosome comes out of a 15 Gb genome by range request.
#
# Requires: curl, awk, python3, bgzip, tabix, samtools (built with libcurl),
#           minimap2 2.31, and the JBrowse CLI (`jbrowse`, or `npx`)
# Usage:    bash build_wheat_introgressions.sh [outdir]
#           CHROM=2B bash build_wheat_introgressions.sh   # Lancer's T. timopheevii segment
#           THREADS=16 bash build_wheat_introgressions.sh   # ~20 min and ~100 GB per cultivar; 4 threads take ~45 min and ~32 GB
#
# Your own genomes: replace MANIFEST. A row is the assembly name, a bgzipped and
# faidx-indexed FASTA (a URL or a path), a sorted GFF3.gz of its genes and the
# prefix its chromosome names carry before the CHROM part. The first row is the
# reference every other row is aligned to.

set -euo pipefail

OUT="${1:-wheat_introgressions}"
CHROM="${CHROM:-2A}"
THREADS="${THREADS:-4}"
mkdir -p "$OUT"
cd "$OUT"

if [ -n "${JBROWSE_CLI:-}" ]; then jb() { $JBROWSE_CLI "$@"; }
elif command -v jbrowse >/dev/null 2>&1; then jb() { jbrowse "$@"; }
else jb() { npx -y @jbrowse/cli "$@"; }; fi

GG=https://avena.pw.usda.gov/GG3pangenome/wheat/jb/jbrowseABD/data
MANIFEST=$(
  cat <<EOF
ChineseSpring	$GG/genomes/T_aestivum_CS_ref2.fa.gz	$GG/gff/T_aestivum_CS_ref2_HC.sorted.gff3.gz	Ta_CS2_
Jagger	$GG/genomes/T_aestivum_Jagger.fa.gz	$GG/gff/T_aestivum_Jagger.sorted.gff3.gz	Ta_Jagger_
Mace	$GG/genomes/T_aestivum_Mace.fa.gz	$GG/gff/T_aestivum_Mace.sorted.gff3.gz	Ta_Mace_
SYMattis	$GG/genomes/T_aestivum_Mattis.fa.gz	$GG/gff/T_aestivum_Mattis.sorted.gff3.gz	Ta_Mattis_
CDCStanley	$GG/genomes/T_aestivum_Stanley.fa.gz	$GG/gff/T_aestivum_Stanley.sorted.gff3.gz	Ta_Stanley_
ArinaLrFor	$GG/genomes/T_aestivum_ArinaLrFor.fa.gz	$GG/gff/T_aestivum_ArinaLrFor.sorted.gff3.gz	Ta_Arina_
Julius	$GG/genomes/T_aestivum_Julius.fa.gz	$GG/gff/T_aestivum_Julius.sorted.gff3.gz	Ta_Julius_
LongReachLancer	$GG/genomes/T_aestivum_Lancer.fa.gz	$GG/gff/T_aestivum_Lancer.sorted.gff3.gz	Ta_Lancer_
CDCLandmark	$GG/genomes/T_aestivum_Landmark.fa.gz	$GG/gff/T_aestivum_Landmark.sorted.gff3.gz	Ta_Landmark_
Norin61	$GG/genomes/T_aestivum_Norin.fa.gz	$GG/gff/T_aestivum_Norin.sorted.gff3.gz	Ta_Norin_
Spelt	$GG/genomes/T_spelta.fa.gz	$GG/gff/T_spelta.sorted.gff3.gz	T_spelta_
EOF
)
REF=$(head -1 <<<"$MANIFEST" | cut -f1)

echo "== chromosome $CHROM of each assembly, by range request"
while IFS=$'\t' read -r name fasta gff prefix; do
  curl -fsSL "$fasta.fai" | cut -f1,2 >"$name.chrom.sizes"
  if [ ! -s "$name.$CHROM.fa" ]; then
    samtools faidx "$fasta" "$prefix$CHROM" >"$name.$CHROM.fa.part"
    mv "$name.$CHROM.fa.part" "$name.$CHROM.fa"
  fi
  if [ ! -s "$name.genes.gff3.gz" ]; then
    curl -fsSL "$gff" | gzip -dc | awk -F'\t' -v c="$prefix$CHROM" '$1==c' |
      bgzip >"$name.genes.gff3.gz.part"
    mv "$name.genes.gff3.gz.part" "$name.genes.gff3.gz"
    # a wheat chromosome runs past the 512 Mb a .tbi can address
    tabix -f -C -p gff "$name.genes.gff3.gz"
  fi
done <<<"$MANIFEST"
rm -f ./*.fa.gz.fai ./*.fa.gz.gzi

echo "== each cultivar against $REF"
while IFS=$'\t' read -r name _ _ prefix; do
  [ "$name" = "$REF" ] && continue
  [ -s "$name.paf" ] && continue
  # the chromosome goes in as contiguous 10 Mb pieces, each named for the
  # offset it starts at, which keeps minimap2's chaining tractable
  awk -v size=10000000 '
    /^>/ { name = substr($1, 2); next }
    { seq = seq $0 }
    END {
      for (s = 0; s < length(seq); s += size)
        printf ">%s:%d\n%s\n", name, s, substr(seq, s + 1, size)
    }' "$name.$CHROM.fa" >"$name.pieces.fa"
  # --eqx writes the =/X CIGAR the identity colour is computed from; the awk
  #   keeps primary alignments, so a repeat copied elsewhere cannot stand in
  #   for the locus, puts each piece back at its offset on the whole
  #   chromosome and gives both names the PanSN prefix of their assembly
  minimap2 -x asm20 -c --eqx -t "$THREADS" "$REF.$CHROM.fa" "$name.pieces.fa" |
    awk -F'\t' -v OFS='\t' -v q="$name#0#" -v t="$REF#0#" \
      -v len="$(awk -v c="$prefix$CHROM" '$1 == c { print $2 }' "$name.chrom.sizes")" '
      /\ttp:A:P/ {
        split($1, piece, ":")
        $1 = q piece[1]; $2 = len; $3 += piece[2]; $4 += piece[2]
        $6 = t $6
        print
      }' >"$name.paf.part"
  rm "$name.pieces.fa"
  mv "$name.paf.part" "$name.paf"
done <<<"$MANIFEST"

echo "== percent identity along $REF $CHROM, 10 Mb windows"
python3 - "$REF" <<'PY'
import glob
import sys

ref = sys.argv[1]
window = 10_000_000
table = {}
for path in sorted(glob.glob('*.paf')):
    name = path[:-4]
    bins = table.setdefault(name, {})
    for line in open(path):
        f = line.split('\t')
        start, end, matches, block = int(f[7]), int(f[8]), int(f[9]), int(f[10])
        b = bins.setdefault((start + end) // 2 // window, [0, 0])
        b[0] += matches
        b[1] += block
last = max(max(bins) for bins in table.values())
with open('identity_by_window.tsv', 'w') as fh:
    fh.write('window_mb\t' + '\t'.join(table) + '\n')
    for w in range(last + 1):
        cells = []
        for bins in table.values():
            m, b = bins.get(w, (0, 0))
            cells.append(f'{100 * m / b:.1f}' if b else 'NA')
        fh.write(f'{w * 10}\t' + '\t'.join(cells) + '\n')
PY
head -8 identity_by_window.tsv | column -t

echo "== the alignments as one indexed PIF"
cat ./*.paf >"wheat_$CHROM.paf"
jb make-pif "wheat_$CHROM.paf" --csi --out "wheat_$CHROM.pif.gz"

echo "== config.json"
REF="$REF" CHROM="$CHROM" MANIFEST="$MANIFEST" python3 - <<'PY'
import json
import os

ref, chrom = os.environ['REF'], os.environ['CHROM']
rows = [line.split('\t') for line in os.environ['MANIFEST'].splitlines()]
names = [r[0] for r in rows]
ref_contig = next(r[3] for r in rows if r[0] == ref) + chrom


def uri(u):
    return {'uri': u, 'locationType': 'UriLocation'}


config = {
    'assemblies': [
        {
            'name': name,
            'sequence': {
                'type': 'ReferenceSequenceTrack',
                'trackId': f'{name}-ReferenceSequenceTrack',
                'adapter': {
                    'type': 'ChromSizesAdapter',
                    'chromSizesLocation': uri(f'{name}.chrom.sizes'),
                },
            },
        }
        for name in names
    ],
    'tracks': [
        {
            'type': 'FeatureTrack',
            'trackId': f'{name}_genes',
            'name': f'{name} genes',
            'assemblyNames': [name],
            'adapter': {
                'type': 'Gff3TabixAdapter',
                'uri': f'{name}.genes.gff3.gz',
                'csi': True,
            },
        }
        for name in names
    ]
    + [
        {
            'type': 'SyntenyTrack',
            'trackId': f'wheat_{chrom}',
            'name': f'Chromosome {chrom}, ten cultivars vs {ref}',
            'assemblyNames': names,
            'adapter': {
                'type': 'MultiGenomeIndexedPAFAdapter',
                'uri': f'wheat_{chrom}.pif.gz',
                'csi': True,
                'assemblyNames': names,
            },
            'displays': [
                {
                    'type': 'MultiWaySyntenyDisplay',
                    'displayId': f'wheat_{chrom}-MultiWaySyntenyDisplay',
                    'height': 700,
                    'rows': {'domain': names[1:]},
                    'ribbonColor': {'field': 'identity'},
                    'laneGeneTracks': [f'{name}_genes' for name in names],
                }
            ],
        }
    ],
    'defaultSession': {
        'name': f'Chromosome {chrom} of ten wheat cultivars',
        'views': [
            {
                'type': 'LinearGenomeView',
                'assembly': ref,
                'loc': ref_contig,
                'tracks': [
                    {'trackId': f'wheat_{chrom}', 'type': 'MultiWaySyntenyDisplay'}
                ],
            }
        ],
    },
}
with open('config.json', 'w') as fh:
    json.dump(config, fh, indent=2)
PY

echo "Wrote $(pwd)/wheat_$CHROM.pif.gz{,.csi}, *.genes.gff3.gz{,.csi}, *.chrom.sizes, identity_by_window.tsv, config.json"
