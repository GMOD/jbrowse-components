#!/usr/bin/env bash
#
# Reproducibly build the CYP1A2 track that
# website/docs/tutorials/dog10k_lof.md follows along in.
#
# CYP1A2 metabolizes a long list of drugs, and dogs carry a nonsense variant in
# it: chr30:38,261,635 C>T on UU_Cfam_GSD_1.0 turns codon 373's CGA into TGA.
# This script slices the locus out of the public Dog10K SNV callset for breeds
# that carry the allele, two that do not, and four gray wolves.
#
# The variant's position is not hardcoded from a paper: derive_stop.py rebuilds
# CYP1A2's coding sequence from the reference and reports which C>T creates the
# stop, so the coordinate can be re-checked rather than trusted.
#
# Requires: bcftools (>= 1.17, with libcurl support), htslib (tabix), curl,
#           python3.
# Usage:    bash scripts/build_dog10k_cyp1a2.sh [outdir]
set -euo pipefail

OUTDIR="${1:-dog10k_cyp1a2_build}"
SHARE=https://kiddlabshare.med.umich.edu/dog10K
SNVS=$SHARE/SNP_and_indel_calls_2021-10-17/AutoAndXPAR.SNPs.vqsr99.vcf.gz
REGION=chr30:38258000-38265000

mkdir -p "$OUTDIR"
cd "$OUTDIR"

[ -f samples.txt ] || curl -fsSL -o samples.txt \
  "$SHARE/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt"

# ── Where the stop codon is ─────────────────────────────────────────────────
# Rebuild the CDS from the reference and the RefSeq exon structure, translate
# it, and report the genomic position of codon 373. Both come from the UCSC API
# for canFam4, which is UU_Cfam_GSD_1.0.
python3 - <<'PY'
import json
import urllib.request

API = 'https://api.genome.ucsc.edu/getData'
CHROM, START, END = 'chr30', 38258000, 38265000


def get(url):
    with urllib.request.urlopen(url) as fh:
        return json.load(fh)


tx = [
    t
    for t in get(
        f'{API}/track?genome=canFam4;track=ncbiRefSeqCurated;'
        f'chrom={CHROM};start={START};end={END}'
    )['ncbiRefSeqCurated']
    if t['name'].startswith('NM_')
][0]
seq = get(f'{API}/sequence?genome=canFam4;chrom={CHROM};start={START};end={END}')
seq = seq['dna'].upper()

starts = [int(x) for x in tx['exonStarts'].rstrip(',').split(',')]
ends = [int(x) for x in tx['exonEnds'].rstrip(',').split(',')]
cds, gpos = '', []
for s, e in zip(starts, ends):
    a, b = max(s, tx['cdsStart']), min(e, tx['cdsEnd'])
    if a < b:
        cds += seq[a - START:b - START]
        gpos += list(range(a, b))

bases = 'TCAG'
aas = ('FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVV'
       'AAAADDEEGGGG')
code = {
    b1 + b2 + b3: aas[i]
    for i, (b1, b2, b3) in enumerate(
        (x, y, z) for x in bases for y in bases for z in bases
    )
}
prot = ''.join(code.get(cds[i:i + 3], 'X') for i in range(0, len(cds) - 2, 3))
codon = cds[372 * 3:373 * 3]
print(f'{tx["name"]} CDS {len(cds)} bp, {len(prot)} aa')
print(f'codon 373 = {codon} ({prot[372]}) at {CHROM}:{gpos[372 * 3] + 1}')
print('C>T at that first base makes TGA, a stop')
PY

# ── Samples ─────────────────────────────────────────────────────────────────
# Breeds carrying the nonsense allele, two that do not, and Greek gray wolves.
python3 - <<'PY' > cyp.samples
rows = [l.rstrip('\n').split('\t') for l in open('samples.txt')][1:]
groups = [('German Hound', 6), ('Bohemian Shepherd', 6),
          ('Shetland Sheepdog', 4), ('Black Russian Terrier', 5),
          ('Keeshond', 6), ('Labrador Retriever', 5), ('Boxer', 4)]
out = []
for breed, n in groups:
    out += [r[0] for r in rows if r[1] == breed][:n]
out += [r[0] for r in rows if r[2] == 'Wolf' and r[1] == 'Greece'][:4]
print('\n'.join(out))
PY

# ── Slice ───────────────────────────────────────────────────────────────────
# The callset is 397 GB; bcftools reads only this gene over HTTP.
bcftools view -r "$REGION" -S cyp.samples --force-samples \
  -Oz -o dog10k_cyp1a2_snvs.vcf.gz "$SNVS"
tabix -f -p vcf dog10k_cyp1a2_snvs.vcf.gz

echo
echo "Genotypes at the stop codon:"
bcftools query -r chr30:38261635-38261636 -i 'POS=38261635' \
  -f '[%SAMPLE=%GT ]\n' dog10k_cyp1a2_snvs.vcf.gz \
  | tr ' ' '\n' | grep -v '=0/0' || true

echo
echo "Wrote $(pwd)/dog10k_cyp1a2_snvs.vcf.gz (plus its .tbi)."
